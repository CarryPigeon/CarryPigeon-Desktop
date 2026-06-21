<script setup lang="ts">
/**
 * @fileoverview FileManagerPage.vue
 * @description files｜文件管理页面（增强版：排序、多选、删除、预览、无限滚动）。
 */

import { ref, onMounted, onUnmounted, computed, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { getFilesCapabilities } from "../../api";
import { getChatCapabilities } from "@/features/chat/public/api";
import { readAuthToken } from "@/shared/utils/localState";
import { buildFileDownloadUrl } from "@/shared/file-transfer";
import { downloadFile } from "@/shared/file-transfer";
import FileSearchBar from "../components/FileSearchBar.vue";
import FileToolbar from "../components/FileToolbar.vue";
import FileListTable from "../components/FileListTable.vue";
import FilePreviewPanel from "../components/FilePreviewPanel.vue";
import DeleteConfirmDialog from "../components/DeleteConfirmDialog.vue";
import DownloadProgressToast from "../components/DownloadProgressToast.vue";
import type { FileListQuery, FileRecord, FileSortField, SortOrder } from "../../domain/contracts";
import ErrorBoundary from "@/shared/ui/ErrorBoundary.vue";
import SkeletonBlock from "@/shared/ui/SkeletonBlock.vue";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("files");

const router = useRouter();
const { t } = useI18n();

// 状态
const files = ref<FileRecord[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(true);
const error = ref<string | null>(null);
const PAGE_SIZE = 20;

const sortBy = ref<FileSortField>("uploadedAt");
const sortOrder = ref<SortOrder>("desc");
const currentQuery = ref<FileListQuery>({});

// Selection
const selectedIds = ref<Set<string>>(new Set());

// Preview
const previewFile = ref<FileRecord | null>(null);
const showPreview = ref(false);

// Delete
const showDeleteConfirm = ref(false);
const deletingIds = ref<string[]>([]);

// Capabilities
const capabilities = getFilesCapabilities();

// IntersectionObserver for infinite scroll
let observer: IntersectionObserver | null = null;
const sentinelRef = ref<HTMLDivElement | null>(null);

const isDeletingMultiple = computed(() => deletingIds.value.length > 1);

/** 递增请求 ID，用于丢弃被覆盖的请求结果。 */
let requestSeq = 0;

async function loadFiles(reset: boolean = false): Promise<void> {
  const socket = getChatCapabilities().getServerSocket();
  if (!socket) {
    error.value = "No active server connection";
    return;
  }
  const token = readAuthToken(socket) || "";

  if (reset) {
    loading.value = true;
    files.value = [];
  } else {
    loadingMore.value = true;
  }

  const seq = ++requestSeq;

  try {
    const query: FileListQuery = {
      ...currentQuery.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      offset: reset ? 0 : files.value.length,
      limit: PAGE_SIZE,
    };

    const result = await capabilities.listFiles(socket, token, query);
    if (seq !== requestSeq) return; // 被后续请求覆盖，丢弃

    if (reset) {
      files.value = result;
    } else {
      files.value.push(...result);
    }

    hasMore.value = result.length > PAGE_SIZE;
    error.value = null;
  } catch (e) {
    if (seq !== requestSeq) return; // 被覆盖，不更新错误状态
    logger.error("Action: api_file_list_failed", { error: String(e) });
    error.value = String(e);
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function handleSearch(query: FileListQuery): void {
  currentQuery.value = { ...currentQuery.value, ...query };
  loadFiles(true);
  selectedIds.value = new Set();
  closePreview();
}

function handleSort(field: FileSortField): void {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = field;
    sortOrder.value = "desc";
  }
  loadFiles(true);
  selectedIds.value = new Set();
}

function handleSortOrderChange(order: SortOrder): void {
  sortOrder.value = order;
  loadFiles(true);
}

function handleToggleSelect(fileId: string): void {
  const next = new Set(selectedIds.value);
  if (next.has(fileId)) {
    next.delete(fileId);
  } else {
    next.add(fileId);
  }
  selectedIds.value = next;
}

function handleSelectAll(): void {
  selectedIds.value = new Set(files.value.map((f) => f.id));
}

function handleDeselectAll(): void {
  selectedIds.value = new Set();
}

function handleClearSelection(): void {
  selectedIds.value = new Set();
}

async function handleDownload(file: FileRecord): Promise<void> {
  const socket = getChatCapabilities().getServerSocket();
  const token = readAuthToken(socket || "") || "";
  const url = buildFileDownloadUrl(socket || "", file.shareKey);
  if (url) {
    try {
      await downloadFile(url, token);
      logger.info("Action: api_file_download_completed", { fileId: file.id });
    } catch (e) {
      logger.error("Action: api_file_download_failed", { error: String(e) });
    }
  }
}

function handlePreview(file: FileRecord): void {
  previewFile.value = file;
  showPreview.value = true;
}

function closePreview(): void {
  showPreview.value = false;
  previewFile.value = null;
}

function handleDeleteRequest(file: FileRecord): void {
  deletingIds.value = [file.id];
  showDeleteConfirm.value = true;
}

function handleBatchDeleteRequest(): void {
  deletingIds.value = Array.from(selectedIds.value);
  showDeleteConfirm.value = true;
}

async function confirmDelete(): Promise<void> {
  const socket = getChatCapabilities().getServerSocket();
  if (!socket) return;
  const token = readAuthToken(socket) || "";

  try {
    if (isDeletingMultiple.value) {
      await capabilities.batchDeleteFiles(socket, token, { fileIds: deletingIds.value });
    } else {
      const file = files.value.find((f) => f.id === deletingIds.value[0]);
      if (!file) return;
      await capabilities.deleteFile(socket, token, { fileId: file.id, shareKey: file.shareKey });
    }

    // Remove deleted files from list
    const deleteSet = new Set(deletingIds.value);
    files.value = files.value.filter((f) => !deleteSet.has(f.id));
    selectedIds.value = new Set();
    showDeleteConfirm.value = false;
    deletingIds.value = [];

    // Close preview if the previewed file was deleted
    if (previewFile.value && deleteSet.has(previewFile.value.id)) {
      closePreview();
    }

    // If current page is now empty and hasMore, reload
    if (files.value.length === 0 && hasMore.value) {
      loadFiles(true);
    }
  } catch (e) {
    logger.error("Action: api_file_delete_failed", { error: String(e) });
    showDeleteConfirm.value = false;
  }
}

function cancelDelete(): void {
  showDeleteConfirm.value = false;
  deletingIds.value = [];
}

function handleOpenChannel(file: FileRecord): void {
  if (file.channelId) {
    router.push({ path: "/chat", query: { channel: file.channelId } });
  }
}

async function handleCopyLink(file: FileRecord): Promise<void> {
  const { copyTextToClipboard } = await import("@/shared/utils/clipboard");
  const ok = await copyTextToClipboard(file.shareKey);
  if (ok) {
    logger.info("Action: api_file_copy_link", { fileId: file.id });
  } else {
    logger.error("Action: api_file_copy_link_failed", { fileId: file.id });
  }
}

// Infinite scroll setup
onMounted(() => {
  loadFiles(true);

  nextTick(() => {
    if (!sentinelRef.value) return;
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore.value && !loadingMore.value && !loading.value) {
          loadFiles(false);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinelRef.value);
  });
});

onUnmounted(() => {
  observer?.disconnect();
});
</script>

<template>
  <main class="cp-fileManager">
    <ErrorBoundary>
      <header class="cp-fileManager__head">
        <button class="cp-fileManager__back" type="button" @click="router.back()">{{ t("back") }}</button>
        <div class="cp-fileManager__title">{{ t("file_manager") }}</div>
      </header>

      <FileSearchBar @search="handleSearch" />

      <FileToolbar
        :sort-by="sortBy"
        :sort-order="sortOrder"
        :selected-count="selectedIds.size"
        @update:sort-by="handleSort"
        @update:sort-order="handleSortOrderChange"
        @batch-delete="handleBatchDeleteRequest"
        @clear-selection="handleClearSelection"
      />

      <div v-if="loading" class="cp-fileManager__skeleton">
        <div v-for="i in 5" :key="i" class="cp-fileManager__skeletonRow">
          <SkeletonBlock variant="text" width="60%" />
          <SkeletonBlock variant="text" width="30%" />
          <SkeletonBlock variant="text" width="10%" />
        </div>
      </div>

      <div v-else-if="error" class="cp-fileManager__error">
        <p>{{ error }}</p>
        <button class="cp-fileManager__retryBtn" type="button" @click="loadFiles(true)">{{ t("retry") }}</button>
      </div>

      <FileListTable
        v-else
        :files="files"
        :sort-by="sortBy"
        :sort-order="sortOrder"
        :selected-ids="selectedIds"
        :loading="loading"
        @sort="handleSort"
        @toggle-select="handleToggleSelect"
        @select-all="handleSelectAll"
        @deselect-all="handleDeselectAll"
        @download="handleDownload"
        @delete="handleDeleteRequest"
        @preview="handlePreview"
        @open-channel="handleOpenChannel"
        @copy-link="handleCopyLink"
      />

      <!-- Infinite scroll sentinel -->
      <div ref="sentinelRef" class="cp-fileManager__sentinel">
        <div v-if="loadingMore" class="cp-fileManager__loadingMore">
          <span>{{ t("loading") }}</span>
        </div>
      </div>

      <!-- Preview Panel -->
      <FilePreviewPanel
        :file="previewFile"
        :visible="showPreview"
        @close="closePreview"
        @download="handleDownload"
        @delete="handleDeleteRequest"
        @open-channel="handleOpenChannel"
        @copy-link="handleCopyLink"
      />

      <!-- Delete Confirmation -->
      <DeleteConfirmDialog
        :visible="showDeleteConfirm"
        :count="deletingIds.length"
        @confirm="confirmDelete"
        @cancel="cancelDelete"
      />

      <!-- Download Progress -->
      <DownloadProgressToast />
    </ErrorBoundary>
  </main>
</template>

<style scoped lang="scss">
.cp-fileManager {
  height: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.cp-fileManager__head {
  background: var(--cp-surface);
  backdrop-filter: blur(16px) saturate(1.08);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
  border: 1px solid var(--cp-border);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  padding: 14px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
}

.cp-fileManager__back {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

.cp-fileManager__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-fileManager__title {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

.cp-fileManager__skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
}

.cp-fileManager__skeletonRow {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 12px 16px;
  background: var(--cp-surface);
  border-radius: 12px;
}

.cp-fileManager__error {
  text-align: center;
  padding: 40px;
  color: var(--cp-text-muted);
}

.cp-fileManager__retryBtn {
  margin-top: 12px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
}

.cp-fileManager__sentinel {
  height: 1px;
}

.cp-fileManager__loadingMore {
  text-align: center;
  padding: 20px;
  color: var(--cp-text-muted);
  font-size: 12px;
}
</style>
