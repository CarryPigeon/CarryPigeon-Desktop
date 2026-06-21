<script setup lang="ts">
/**
 * @fileoverview FileSearchBar.vue
 * @description files｜文件列表搜索栏（增强版：类型/上传者/日期筛选）。
 */

import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { debounce } from "@/shared/utils/rateLimit";
import { getFilesCapabilities } from "../../api";
import { getChatCapabilities } from "@/features/chat/public/api";
import { readAuthToken } from "@/shared/utils/localState";
import type { FileListQuery, UploaderInfo } from "../../domain/contracts";

const emit = defineEmits<{
  (e: "search", query: FileListQuery): void;
}>();

const { t } = useI18n();

const capabilities = getFilesCapabilities();
const uploaders = ref<UploaderInfo[]>([]);

const filters = ref({
  uploaderId: "",
  dateFrom: "",
  dateTo: "",
});

onMounted(async () => {
  const socket = getChatCapabilities().getServerSocket();
  if (!socket) return;
  const token = readAuthToken(socket) || "";
  try {
    uploaders.value = await capabilities.listUploaders(socket, token);
  } catch {
    // Uploader list is optional — silently degrade
  }
});

const handleInput = debounce(function (event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  emit("search", { search: value || undefined });
}, 300);

function handleTypeSelect(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  emit("search", { mimePrefix: value || undefined });
}

function handleUploaderChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  filters.value.uploaderId = value;
  emitSearch();
}

function handleDateChange(): void {
  emitSearch();
}

function emitSearch(): void {
  const q: FileListQuery = {};
  if (filters.value.uploaderId) q.uploaderId = filters.value.uploaderId;
  if (filters.value.dateFrom) q.dateFrom = filters.value.dateFrom;
  if (filters.value.dateTo) q.dateTo = filters.value.dateTo;
  emit("search", q);
}
</script>

<template>
  <div class="cp-fileSearch">
    <input
      class="cp-fileSearch__input"
      type="text"
      :placeholder="t('file_search_placeholder')"
      @input="handleInput"
    />
    <select class="cp-fileSearch__select" @change="handleTypeSelect">
      <option value="">{{ t("file_type") }}: {{ t("all") }}</option>
      <option value="image/">{{ t("file_type") }}: Image</option>
      <option value="text/">{{ t("file_type") }}: Text</option>
      <option value="application/pdf">PDF</option>
      <option value="application/zip">Archive</option>
      <option value="video/">Video</option>
      <option value="audio/">Audio</option>
    </select>
    <select
      v-if="uploaders.length > 0"
      class="cp-fileSearch__select"
      :value="filters.uploaderId"
      @change="handleUploaderChange"
    >
      <option value="">{{ t("file_uploader_filter") }}: {{ t("all") }}</option>
      <option v-for="u in uploaders" :key="u.id" :value="u.id">{{ u.name }}</option>
    </select>
    <input
      class="cp-fileSearch__date"
      type="date"
      :value="filters.dateFrom"
      :placeholder="t('file_date_filter')"
      @change="handleDateChange"
    />
    <input
      class="cp-fileSearch__date"
      type="date"
      :value="filters.dateTo"
      :placeholder="t('file_date_filter')"
      @change="handleDateChange"
    />
  </div>
</template>

<style scoped lang="scss">
.cp-fileSearch {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.cp-fileSearch__input {
  flex: 1;
  min-width: 160px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 13px;
  outline: none;
}

.cp-fileSearch__select,
.cp-fileSearch__date {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 13px;
  outline: none;
  cursor: pointer;
}

.cp-fileSearch__date {
  width: 140px;
}
</style>
