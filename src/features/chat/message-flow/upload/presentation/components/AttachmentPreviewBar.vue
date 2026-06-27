<script setup lang="ts">
/**
 * @fileoverview AttachmentPreviewBar.vue
 * @description chat/message-flow/upload｜附件预览条：在 composer 上方展示待发送的附件。
 *
 * 支持三种附件种类：
 * - image / video：渲染缩略图，点击触发 lightbox。
 * - file：渲染文件图标 + 文件名 + 体积，点击不触发 lightbox。
 */

import type { FileAttachment } from "../runtime/fileAttachmentStore";

defineProps<{
  /**
   * 当前待发送/上传中的附件列表。
   */
  attachments: readonly FileAttachment[];
}>();

const emit = defineEmits<{
  /**
   * 移除指定附件。
   */
  (e: "remove", id: string): void;
  /**
   * 重试上传失败的附件。
   */
  (e: "retry", id: string): void;
  /**
   * 打开图片/视频灯箱预览。
   */
  (e: "openLightbox", payload: { url: string; fileName: string; isVideo?: boolean }): void;
}>();

/**
 * 处理附件项点击：仅媒体类型触发灯箱。
 *
 * @param att - 被点击的附件。
 */
function onItemClick(att: FileAttachment): void {
  if (att.kind === "file") return;
  emit("openLightbox", {
    url: att.blobUrl,
    fileName: att.file.name,
    isVideo: att.kind === "video",
  });
}

/**
 * 将字节数格式化为人类可读字符串。
 *
 * @param bytes - 字节数。
 * @returns 形如 `1.2 MB` 的字符串。
 */
function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
</script>

<template>
  <!-- 组件：AttachmentPreviewBar｜职责：展示待发送图片/视频/文件附件预览 -->
  <div v-if="attachments.length" class="cp-attachmentBar">
    <div class="cp-attachmentBar__list">
      <div
        v-for="att in attachments"
        :key="att.id"
        class="cp-attachmentBar__item"
        :class="{ 'cp-attachmentBar__item--file': att.kind === 'file' }"
        :title="att.file.name"
        @click="onItemClick(att)"
      >
        <!-- 媒体缩略图（image/video） -->
        <img
          v-if="att.kind !== 'file'"
          :src="att.blobUrl"
          :alt="att.file.name"
          class="cp-attachmentBar__thumb"
        />

        <!-- 非媒体文件卡片（图标 + 文件名 + 体积） -->
        <div
          v-else
          class="cp-attachmentBar__fileCard"
          role="img"
          :aria-label="`File: ${att.file.name} (${formatSize(att.file.size)})`"
        >
          <div class="cp-attachmentBar__fileIcon" aria-hidden="true">
            <t-icon name="file" />
          </div>
          <div class="cp-attachmentBar__fileMeta">
            <div class="cp-attachmentBar__fileName">{{ att.file.name }}</div>
            <div class="cp-attachmentBar__fileSize">{{ formatSize(att.file.size) }}</div>
          </div>
        </div>

        <!-- 上传进度条 -->
        <div
          v-if="att.status === 'uploading'"
          class="cp-attachmentBar__progress"
        >
          <div
            class="cp-attachmentBar__progressBar"
            :style="{ width: att.progress + '%' }"
          ></div>
        </div>

        <!-- 错误状态 -->
        <div v-if="att.status === 'error'" class="cp-attachmentBar__error">
          <button
            class="cp-attachmentBar__retryBtn"
            type="button"
            :title="att.error || 'Upload failed'"
            @click="emit('retry', att.id)"
          >
            <t-icon name="refresh" />
          </button>
        </div>

        <!-- 完成状态标记 -->
        <div v-if="att.status === 'done'" class="cp-attachmentBar__done">
          <t-icon name="check" />
        </div>

        <!-- 移除按钮（上传中隐藏） -->
        <button
          v-if="att.status !== 'uploading'"
          class="cp-attachmentBar__remove"
          type="button"
          :aria-label="`Remove ${att.file.name}`"
          @click.stop="emit('remove', att.id)"
        >
          <t-icon name="close" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 水平可滚动缩略图条 */
.cp-attachmentBar {
  padding: 8px 0;
}

.cp-attachmentBar__list {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.cp-attachmentBar__item {
  position: relative;
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--cp-border, #e0e0e0);
  background: var(--cp-panel-muted, #f5f5f5);
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), box-shadow var(--cp-fast) var(--cp-ease);
}

.cp-attachmentBar__item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px color-mix(in oklab, var(--cp-accent, #5865f2) 30%, transparent);
}

.cp-attachmentBar__thumb {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 非媒体文件卡片：图标 + 文件名 + 体积 */
.cp-attachmentBar__item--file {
  width: auto;
  min-width: 64px;
  max-width: 180px;
  height: 64px;
  cursor: default;
}

.cp-attachmentBar__fileCard {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 100%;
  padding: 6px 10px;
  box-sizing: border-box;
}

.cp-attachmentBar__fileIcon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: color-mix(in oklab, var(--cp-accent, #5865f2) 14%, transparent);
  color: var(--cp-accent, #5865f2);
  font-size: 16px;
}

.cp-attachmentBar__fileMeta {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  line-height: 1.2;
}

.cp-attachmentBar__fileName {
  font-size: 11px;
  font-weight: 500;
  color: var(--cp-text, #222);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.cp-attachmentBar__fileSize {
  font-size: 10px;
  color: var(--cp-text-muted, #888);
}

.cp-attachmentBar__progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: color-mix(in oklab, var(--cp-border, #e0e0e0) 50%, transparent);
}

.cp-attachmentBar__progressBar {
  height: 100%;
  background: var(--cp-accent, #5865f2);
  transition: width 200ms ease;
}

.cp-attachmentBar__error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--cp-danger, #e34) 20%, transparent);
}

.cp-attachmentBar__retryBtn {
  border: 1px solid var(--cp-danger, #e34);
  background: color-mix(in oklab, var(--cp-danger, #e34) 15%, transparent);
  color: var(--cp-danger, #e34);
  font-size: 16px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  transition: transform 120ms ease;
}

.cp-attachmentBar__retryBtn:hover {
  transform: scale(1.15);
}

.cp-attachmentBar__done {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--cp-success);
  color: #fff;
  font-size: 11px;
  display: grid;
  place-items: center;
  line-height: 1;
}

.cp-attachmentBar__remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: color-mix(in oklab, #000 60%, transparent);
  color: #fff;
  font-size: 12px;
  line-height: 1;
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;
  transition: background 120ms ease;
}

.cp-attachmentBar__remove:hover {
  background: color-mix(in oklab, #000 80%, transparent);
}
</style>
