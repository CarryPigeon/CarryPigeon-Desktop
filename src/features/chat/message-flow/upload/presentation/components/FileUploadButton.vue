<script setup lang="ts">
/**
 * @fileoverview FileUploadButton.vue
 * @description chat/message-flow/upload｜组件：FileUploadButton。
 *
 * 选择文件后将图片加入附件预览条（AttachmentPreviewBar），
 * 上传统一在发送消息时由 sendMessageWithAttachments 执行。
 */

import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { addFiles } from "@/features/chat/message-flow/upload/presentation/runtime/fileAttachmentStore";

const props = defineProps<{
  accept?: string;
  maxSize?: number;
}>();

const emit = defineEmits<{
  (e: "filesSelected", files: File[]): void;
  (e: "error", error: string): void;
}>();

const { t } = useI18n();

const fileInput = ref<HTMLInputElement | null>(null);

/**
 * 打开系统文件选择器。
 */
function handleClick(): void {
  fileInput.value?.click();
}

/**
 * 处理文件选择：将图片文件加入附件预览条。
 *
 * @param e - 文件 input 的 change 事件。
 */
function handleFileChange(e: Event): void {
  const input = e.target as HTMLInputElement;
  const selectedFiles = input.files ? Array.from(input.files) : [];
  input.value = "";

  if (selectedFiles.length === 0) return;

  // 文件大小校验
  if (props.maxSize) {
    const oversized = selectedFiles.filter((f) => f.size > props.maxSize!);
    if (oversized.length > 0) {
      emit("error", t("file_too_large"));
      return;
    }
  }

  // 只保留图片和视频类型
  const mediaFiles = selectedFiles.filter(
    (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
  );
  if (mediaFiles.length === 0) {
    emit("error", t("file_type_not_supported") || "Only image and video files are supported");
    return;
  }

  // 加入附件预览条
  addFiles(mediaFiles);
  emit("filesSelected", mediaFiles);
}
</script>

<template>
  <!-- 组件：FileUploadButton｜职责：选择图片文件并加入附件预览 -->
  <div class="cp-fileUpload">
    <input
      ref="fileInput"
      type="file"
      class="cp-fileUpload__input"
      :accept="accept ?? 'image/*,video/*'"
      multiple
      @change="handleFileChange"
    />
    <button class="cp-fileUpload__btn" type="button" @click="handleClick">
      <span class="cp-fileUpload__icon">+</span>
      <span class="cp-fileUpload__text">{{ t("attach_file") }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
/* FileUploadButton styles */
.cp-fileUpload {
  display: inline-flex;
}

.cp-fileUpload__input {
  display: none;
}

.cp-fileUpload__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-fileUpload__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-fileUpload__icon {
  font-size: 14px;
  font-weight: bold;
}

.cp-fileUpload__text {
  font-size: 12px;
}
</style>
