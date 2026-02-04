<script setup lang="ts">
/**
 * @fileoverview FileUploadButton.vue
 * @description Button component for selecting and uploading files.
 */

import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { uploadFile } from "@/features/files/presentation/store/fileUploadStore";

const props = defineProps<{
  accept?: string;
  maxSize?: number;
}>();

const emit = defineEmits<{
  (e: "uploaded", result: { fileId: string; shareKey: string }): void;
  (e: "error", error: string): void;
}>();

const { t } = useI18n();

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

/**
 * Open native file picker.
 *
 * @returns void
 */
function handleClick(): void {
  fileInput.value?.click();
}

/**
 * Handle file selection and upload.
 *
 * @param e - Change event for file input.
 * @returns Promise<void>.
 */
async function handleFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (props.maxSize && file.size > props.maxSize) {
    emit("error", t("file_too_large"));
    input.value = "";
    return;
  }

  uploading.value = true;
  try {
    const result = await uploadFile(file);
    emit("uploaded", { fileId: result.fileId, shareKey: result.shareKey });
  } catch (err) {
    emit("error", String(err));
  } finally {
    uploading.value = false;
    input.value = "";
  }
}
</script>

<template>
  <!-- 组件：FileUploadButton｜职责：选择文件并触发上传 -->
  <div class="cp-fileUpload">
    <input
      ref="fileInput"
      type="file"
      class="cp-fileUpload__input"
      :accept="props.accept"
      @change="handleFileChange"
    />
    <button class="cp-fileUpload__btn" type="button" :disabled="uploading" @click="handleClick">
      <span class="cp-fileUpload__icon">+</span>
      <span class="cp-fileUpload__text">{{ uploading ? t("uploading") : t("attach_file") }}</span>
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

.cp-fileUpload__btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-fileUpload__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cp-fileUpload__icon {
  font-size: 14px;
  font-weight: bold;
}

.cp-fileUpload__text {
  font-size: 12px;
}
</style>
