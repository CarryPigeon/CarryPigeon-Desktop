<script setup lang="ts">
/**
 * @fileoverview FileListTable.vue
 * @description files｜文件列表表格组件。
 */

import { useI18n } from "vue-i18n";
import type { FileRecord } from "../../domain/contracts";

defineProps<{
  files: FileRecord[];
}>();

const emit = defineEmits<{
  (e: "download", file: FileRecord): void;
}>();

const { t } = useI18n();

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getTypeIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("zip") || mimeType.includes("rar")) return "📦";
  return "📎";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
</script>

<template>
  <div v-if="files.length === 0" class="cp-fileTable__empty">
    {{ t("file_list_empty") }}
  </div>
  <div v-else class="cp-fileTable">
    <div
      v-for="file in files"
      :key="file.id"
      class="cp-fileTable__row"
    >
      <span class="cp-fileTable__icon">{{ getTypeIcon(file.mimeType) }}</span>
      <div class="cp-fileTable__meta">
        <span class="cp-fileTable__name">{{ file.filename }}</span>
        <span class="cp-fileTable__detail">{{ formatSize(file.sizeBytes) }} · {{ formatTime(file.uploadedAt) }}</span>
      </div>
      <span v-if="file.channelName" class="cp-fileTable__channel">{{ file.channelName }}</span>
      <button class="cp-fileTable__btn" type="button" @click="emit('download', file)">
        {{ t("download") }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cp-fileTable__empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--cp-text-muted);
  font-size: 13px;
}

.cp-fileTable__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--cp-border);
  transition: background var(--cp-fast) var(--cp-ease);
}

.cp-fileTable__row:last-child {
  border-bottom: none;
}

.cp-fileTable__row:hover {
  background: var(--cp-hover-bg);
}

.cp-fileTable__icon {
  font-size: 22px;
  flex-shrink: 0;
}

.cp-fileTable__meta {
  flex: 1;
  min-width: 0;
}

.cp-fileTable__name {
  display: block;
  font-size: 13px;
  color: var(--cp-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-fileTable__detail {
  display: block;
  font-size: 11px;
  color: var(--cp-text-muted);
  margin-top: 2px;
}

.cp-fileTable__channel {
  font-size: 11px;
  color: var(--cp-text-muted);
  background: var(--cp-panel-muted);
  padding: 2px 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

.cp-fileTable__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

.cp-fileTable__btn:hover {
  transform: translateY(-1px);
  border-color: var(--cp-highlight-border);
}
</style>
