<script setup lang="ts">
/**
 * @fileoverview UploadProgress.vue
 * @description chat/message-flow/upload｜组件：UploadProgress。
 */

import { useI18n } from "vue-i18n";
import type { UploadTask } from "@/features/chat/message-flow/upload/presentation/runtime/fileUploadStore";

const props = defineProps<{
  task: UploadTask;
}>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "retry"): void;
  (e: "dismiss"): void;
}>();

const { t } = useI18n();

/**
 * 将字节数格式化为紧凑的可读标签。
 *
 * @param bytes - 文件大小（字节）。
 * @returns 人类可读的大小字符串。
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
</script>

<template>
  <!-- 组件：UploadProgress｜职责：上传进度条（取消/重试/关闭） -->
  <div class="cp-uploadProgress" :data-status="props.task.status">
    <div class="cp-uploadProgress__info">
      <div class="cp-uploadProgress__name">{{ props.task.file.name }}</div>
      <div class="cp-uploadProgress__size">{{ formatFileSize(props.task.file.size) }}</div>
    </div>

    <div v-if="props.task.status === 'uploading'" class="cp-uploadProgress__bar">
      <div class="cp-uploadProgress__fill" :style="{ width: `${props.task.progress}%` }"></div>
    </div>

    <div class="cp-uploadProgress__status">
      <span v-if="props.task.status === 'pending'">{{ t("loading") }}</span>
      <span v-else-if="props.task.status === 'uploading'">{{ t("uploading") }} {{ props.task.progress }}%</span>
      <span v-else-if="props.task.status === 'success'" class="success">{{ t("upload_success") }}</span>
      <span v-else-if="props.task.status === 'error'" class="error">{{ t("upload_failed") }}: {{ props.task.error }}</span>
    </div>

    <div class="cp-uploadProgress__actions">
      <button v-if="props.task.status === 'uploading'" class="cp-uploadProgress__btn" type="button" @click="emit('cancel')">
        {{ t("cancel_upload") }}
      </button>
      <button v-if="props.task.status === 'error'" class="cp-uploadProgress__btn" type="button" @click="emit('retry')">
        {{ t("retry_upload") }}
      </button>
      <button v-if="props.task.status === 'success' || props.task.status === 'error'" class="cp-uploadProgress__btn" type="button" @click="emit('dismiss')">
        {{ t("close") }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：UploadProgress｜规格：内嵌卡片 + 进度条 accent + 胶囊按钮 */
.cp-uploadProgress {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: var(--cp-radius-card);
  padding: 12px;
}

.cp-uploadProgress__info {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
}

.cp-uploadProgress__name {
  font-size: 13px;
  color: var(--cp-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.cp-uploadProgress__size {
  font-size: 11px;
  color: var(--cp-text-muted);
  font-family: var(--cp-font-mono);
}

.cp-uploadProgress__bar {
  margin-top: 10px;
  height: 6px;
  border-radius: 999px;
  background: var(--cp-panel-muted);
  overflow: hidden;
}

.cp-uploadProgress__fill {
  height: 100%;
  border-radius: 999px;
  background: var(--cp-accent);
  transition: width var(--cp-slow) var(--cp-ease);
}

.cp-uploadProgress__status {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--cp-text-muted);
}

/* 成功/失败：状态语义色 */
.cp-uploadProgress__status .success {
  color: var(--cp-success);
}

.cp-uploadProgress__status .error {
  color: var(--cp-danger);
}

.cp-uploadProgress__actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* 动作按钮：胶囊按钮（无位移 hover） */
.cp-uploadProgress__btn {
  @include cp-pill-button;

  min-height: 26px;
  padding: 0 10px;
  font-size: 11.5px;
}
</style>
