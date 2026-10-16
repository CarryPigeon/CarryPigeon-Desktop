<script setup lang="ts">
/**
 * @fileoverview FileUploadButton.vue
 * @description chat/message-flow/upload｜组件：FileUploadButton。
 *
 * 选择文件后将其加入附件预览条（AttachmentPreviewBar），
 * 上传统一在发送消息时由 sendMessageWithAttachments 执行。
 *
 * 支持任意类型文件：图片、视频、文档、压缩包等。
 */

import { ref } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "@/shared/ui/AppIcon.vue";
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
 * 处理文件选择：将任意类型的文件加入附件预览条。
 *
 * 文件大小校验仍按 `maxSize` 执行（外部传入时启用）。
 * 文件类型不限，由服务端/网络层做最终约束。
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

  // 加入附件预览条（任意类型）
  addFiles(selectedFiles);
  emit("filesSelected", selectedFiles);
}
</script>

<template>
  <!-- 组件：FileUploadButton｜职责：选择任意类型文件并加入附件预览 -->
  <div class="cp-fileUpload">
    <input
      ref="fileInput"
      type="file"
      class="cp-fileUpload__input"
      :accept="accept"
      multiple
      @change="handleFileChange"
    />
    <button class="cp-fileUpload__btn" type="button" @click="handleClick">
      <!-- 自绘回形针图标（取自统一注册表），与表情/截图按钮同风格 -->
      <AppIcon name="paperclip" :size="18" />
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
  justify-content: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: inherit;
  padding: 0;
  cursor: pointer;
}

.cp-fileUpload__icon {
  display: block;
  flex-shrink: 0;
}

.cp-fileUpload__text {
  font-size: 12px;
}
</style>
