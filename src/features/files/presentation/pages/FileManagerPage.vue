<script setup lang="ts">
/**
 * @fileoverview FileManagerPage.vue
 * @description files｜文件管理页面（搜索、列表、下载）。
 */

import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { getFilesCapabilities } from "../../api";
import { getActiveChatServerSocket } from "@/features/chat/composition/serverWorkspaceAdapter";
import { readAuthToken } from "@/shared/utils/localState";
import { buildFileDownloadUrl } from "@/shared/file-transfer";
import { downloadFile } from "@/shared/file-transfer";
import FileSearchBar from "../components/FileSearchBar.vue";
import FileListTable from "../components/FileListTable.vue";
import type { FileListQuery, FileRecord } from "../../domain/contracts";

const router = useRouter();
const { t } = useI18n();

const files = ref<FileRecord[]>([]);
const loading = ref(false);

const capabilities = getFilesCapabilities();

async function loadFiles(query: FileListQuery = {}): Promise<void> {
  const socket = getActiveChatServerSocket();
  if (!socket) return;
  loading.value = true;
  try {
    files.value = await capabilities.listFiles(socket, query);
  } finally {
    loading.value = false;
  }
}

function handleSearch(query: FileListQuery): void {
  loadFiles(query);
}

async function handleDownload(file: FileRecord): Promise<void> {
  const socket = getActiveChatServerSocket();
  const token = readAuthToken(socket) || "";
  const url = buildFileDownloadUrl(socket, file.shareKey);
  if (url) await downloadFile(url, token);
}

onMounted(() => {
  loadFiles();
});
</script>

<template>
  <main class="cp-fileManager">
    <header class="cp-fileManager__head">
      <button class="cp-fileManager__back" type="button" @click="router.back()">{{ t("back") }}</button>
      <div class="cp-fileManager__title">{{ t("file_manager") }}</div>
    </header>
    <FileSearchBar @search="handleSearch" />
    <div v-if="loading" class="cp-fileManager__loading">{{ t("loading") }}</div>
    <FileListTable v-else :files="files" @download="handleDownload" />
  </main>
</template>

<style scoped lang="scss">
.cp-fileManager {
  height: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.cp-fileManager__loading {
  text-align: center;
  padding: 40px;
  color: var(--cp-text-muted);
}
</style>
