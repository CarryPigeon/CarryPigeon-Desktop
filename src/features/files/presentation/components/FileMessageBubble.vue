<script setup lang="ts">
/**
 * @fileoverview FileMessageBubble.vue
 * @description files｜组件：FileMessageBubble。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { buildDownloadUrl } from "@/features/files/presentation/store/fileUploadStore";

const props = defineProps<{
  filename: string;
  shareKey: string;
  mimeType?: string;
  sizeBytes?: number;
}>();

const { t } = useI18n();

const downloadUrl = computed(() => buildDownloadUrl(props.shareKey));

const isImage = computed(() => {
  const mime = props.mimeType?.toLowerCase() ?? "";
  return mime.startsWith("image/");
});

/**
 * 将字节数格式化为紧凑的可读标签。
 *
 * @param bytes - 文件大小（字节）。
 * @returns 人类可读的大小字符串。
 */
function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 基于 mime type 选择文件图标（emoji）。
 *
 * @param mimeType - 文件 mime type。
 * @returns emoji 图标字符串。
 */
function getFileIcon(mimeType: string | undefined): string {
  const mime = mimeType?.toLowerCase() ?? "";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime.includes("pdf")) return "📄";
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar") || mime.includes("gz")) return "📦";
  if (mime.includes("text/") || mime.includes("document")) return "📝";
  return "📎";
}

/**
 * 在新标签页中打开文件下载链接。
 *
 * @returns 无返回值。
 */
function handleDownload(): void {
  if (!downloadUrl.value) return;
  window.open(downloadUrl.value, "_blank");
}
</script>

<template>
  <!-- 组件：FileMessageBubble｜职责：渲染文件消息气泡 -->
  <div class="cp-fileBubble">
    <div v-if="isImage && downloadUrl" class="cp-fileBubble__preview">
      <img :src="downloadUrl" :alt="props.filename" class="cp-fileBubble__img" />
    </div>
    <div class="cp-fileBubble__info">
      <div class="cp-fileBubble__icon">{{ getFileIcon(props.mimeType) }}</div>
      <div class="cp-fileBubble__meta">
        <div class="cp-fileBubble__name">{{ props.filename }}</div>
        <div v-if="props.sizeBytes" class="cp-fileBubble__size">{{ formatFileSize(props.sizeBytes) }}</div>
      </div>
    </div>
    <button v-if="downloadUrl" class="cp-fileBubble__btn" type="button" @click="handleDownload">
      {{ t("download") }}
    </button>
  </div>
</template>

<style scoped lang="scss">
/* FileMessageBubble styles */
.cp-fileBubble {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 12px;
  max-width: 320px;
}

.cp-fileBubble__preview {
  margin-bottom: 10px;
  border-radius: 12px;
  overflow: hidden;
}

.cp-fileBubble__img {
  display: block;
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  background: var(--cp-panel-muted);
}

.cp-fileBubble__info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cp-fileBubble__icon {
  font-size: 24px;
}

.cp-fileBubble__meta {
  flex: 1;
  min-width: 0;
}

.cp-fileBubble__name {
  font-size: 13px;
  color: var(--cp-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-fileBubble__size {
  margin-top: 4px;
  font-size: 11px;
  color: var(--cp-text-muted);
  font-family: var(--cp-font-mono);
}

.cp-fileBubble__btn {
  margin-top: 10px;
  width: 100%;
  border: 1px solid color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 10%, var(--cp-panel-muted));
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-fileBubble__btn:hover {
  transform: translateY(-1px);
  background: color-mix(in oklab, var(--cp-accent) 18%, var(--cp-hover-bg));
}
</style>
