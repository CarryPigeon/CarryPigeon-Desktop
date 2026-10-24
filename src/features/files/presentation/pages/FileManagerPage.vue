<script setup lang="ts">
/**
 * @fileoverview FileManagerPage.vue
 * @description files｜文件管理页面（增强版：排序、多选、删除、预览、无限滚动）。
 */

import { ref, onMounted, onUnmounted, computed, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { getFilesCapabilities } from "../../api";
import { readActiveFileServerSocket } from "../../composition/activeServerSocket";
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
import PageHeader from "@/shared/ui/PageHeader.vue";
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
  const socket = readActiveFileServerSocket();
  if (!socket) {
    error.value = t("file_no_active_server");
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
  const socket = readActiveFileServerSocket();
  if (!socket) {
    logger.error("Action: api_file_download_failed", { error: "missing_server_socket" });
    return;
  }
  const token = readAuthToken(socket) || "";
  const url = buildFileDownloadUrl(socket, file.shareKey);
  if (url) {
    try {
      await downloadFile(url, token, socket);
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
  const socket = readActiveFileServerSocket();
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
      <PageHeader
        :title="t('file_manager')"
        back
        data-testid="files-header"
        @back="router.back()"
      />

      <!-- 区块：一级玻璃面板｜用途：搜索 / 工具条 / 列表共用同一承载面 -->
      <section class="cp-fileManager__panel">
        <div class="cp-fileManager__searchZone">
          <FileSearchBar @search="handleSearch" />
        </div>

        <div class="cp-fileManager__toolZone">
          <FileToolbar
            :sort-by="sortBy"
            :sort-order="sortOrder"
            :selected-count="selectedIds.size"
            @update:sort-by="handleSort"
            @update:sort-order="handleSortOrderChange"
            @batch-delete="handleBatchDeleteRequest"
            @clear-selection="handleClearSelection"
          />
        </div>

        <div class="cp-fileManager__list">
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
        </div>
      </section>

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
/* 样式：文件管理页｜布局：工作台骨架 + PageHeader + 透明内容区（搜索/工具条/列表）｜约束：列表在区域内滚动 */
.cp-fileManager {
  @include cp-workspace;

  overflow: hidden;
}

/* 内容区域：共享玻璃面上的透明承载面 */
.cp-fileManager__panel {
  @include cp-region;

  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 搜索区：区域内上留白 */
.cp-fileManager__searchZone {
  padding: 10px 10px 8px;
}

/* 工具条区：与列表之间不再画分隔线，靠间距分组 */
.cp-fileManager__toolZone {
  padding: 0 10px 8px;
}

/* 列表滚动容器：区域内唯一滚动区 */
.cp-fileManager__list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

/* 骨架行：与数据行同高（44px） */
.cp-fileManager__skeleton {
  display: flex;
  flex-direction: column;
}

.cp-fileManager__skeletonRow {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 44px;
  padding: 4px 10px;
}

/* 错误态：danger 状态条 + 重试胶囊 */
.cp-fileManager__error {
  @include cp-inline-status(danger);

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin: 16px;
  padding: 28px 20px;
  text-align: center;
}

.cp-fileManager__error p {
  margin: 0;
}

.cp-fileManager__retryBtn {
  @include cp-pill-button;

  background: var(--cp-panel);
}

.cp-fileManager__sentinel {
  height: 1px;
}

.cp-fileManager__loadingMore {
  padding: 20px;
  text-align: center;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* 响应式：≤640px 只压缩内容内边距，页面留白保持 8px */
@media (max-width: 640px) {
  .cp-fileManager__searchZone,
  .cp-fileManager__toolZone {
    padding-left: 8px;
    padding-right: 8px;
  }
}
</style>
