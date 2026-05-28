<script setup lang="ts">
/**
 * @fileoverview AttachmentPreviewBar.vue
 * @description chat/message-flow/upload｜附件预览条：在 composer 上方展示待发送的图片缩略图。
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
}>();
</script>

<template>
  <!-- 组件：AttachmentPreviewBar｜职责：展示待发送图片缩略图预览 -->
  <div v-if="attachments.length" class="cp-attachmentBar">
    <div class="cp-attachmentBar__list">
      <div
        v-for="att in attachments"
        :key="att.id"
        class="cp-attachmentBar__item"
      >
        <!-- 缩略图 -->
        <img
          :src="att.blobUrl"
          :alt="att.file.name"
          class="cp-attachmentBar__thumb"
        />

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
            ↻
          </button>
        </div>

        <!-- 完成状态标记 -->
        <div v-if="att.status === 'done'" class="cp-attachmentBar__done">
          ✓
        </div>

        <!-- 移除按钮（上传中隐藏） -->
        <button
          v-if="att.status !== 'uploading'"
          class="cp-attachmentBar__remove"
          type="button"
          aria-label="Remove attachment"
          @click.stop="emit('remove', att.id)"
        >
          ×
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
}

.cp-attachmentBar__thumb {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  background: var(--cp-success, #2a8c5a);
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
