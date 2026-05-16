<script setup lang="ts">
/**
 * @fileoverview DownloadProgress.vue
 * @description chat/message-flow/download｜下载进度条组件。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { DownloadTask } from "@/shared/file-transfer";

const props = defineProps<{
  task: DownloadTask;
}>();

const emit = defineEmits<{
  (e: "dismiss", taskId: string): void;
}>();

const { t } = useI18n();

const isActive = computed(() => props.task.status === "downloading" || props.task.status === "pending");

const statusText = computed(() => {
  switch (props.task.status) {
    case "pending":
      return t("file_downloading");
    case "downloading":
      return `${props.task.progress}%`;
    case "completed":
      return t("download_success");
    case "error":
      return t("download_failed");
  }
});
</script>

<template>
  <div class="cp-downloadProgress" :data-status="task.status">
    <div class="cp-downloadProgress__info">
      <span class="cp-downloadProgress__name">{{ task.filename }}</span>
      <span class="cp-downloadProgress__status">{{ statusText }}</span>
    </div>
    <div v-if="isActive" class="cp-downloadProgress__bar">
      <div class="cp-downloadProgress__fill" :style="{ width: task.progress + '%' }" />
    </div>
    <div v-if="task.status === 'completed' || task.status === 'error'" class="cp-downloadProgress__actions">
      <button class="cp-downloadProgress__btn" type="button" @click="emit('dismiss', task.id)">
        {{ t("close") }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cp-downloadProgress {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 12px;
  padding: 10px;
  margin-top: 8px;
}

.cp-downloadProgress[data-status="completed"] {
  border-color: color-mix(in oklab, var(--cp-success) 24%, var(--cp-border));
}

.cp-downloadProgress[data-status="error"] {
  border-color: color-mix(in oklab, var(--cp-danger) 30%, var(--cp-border));
}

.cp-downloadProgress__info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.cp-downloadProgress__name {
  font-size: 12px;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-downloadProgress__status {
  font-size: 11px;
  color: var(--cp-text-muted);
  font-family: var(--cp-font-mono);
}

.cp-downloadProgress__bar {
  margin-top: 6px;
  height: 4px;
  background: var(--cp-panel-muted);
  border-radius: 999px;
  overflow: hidden;
}

.cp-downloadProgress__fill {
  height: 100%;
  background: var(--cp-accent);
  border-radius: 999px;
  transition: width 0.3s var(--cp-ease);
}

.cp-downloadProgress__actions {
  margin-top: 6px;
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.cp-downloadProgress__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
}
</style>
