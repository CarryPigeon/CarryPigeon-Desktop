<script setup lang="ts">
/**
 * @fileoverview DownloadProgressToast.vue
 * @description files｜下载进度提示组件。失败态展示「下载失败」并保留 taskId
 *              以便调用方（行级按钮）触发续传。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { getDownloadTasks, getCurrentTaskId } from "@/shared/file-transfer/downloadStore";
import AppIcon from "@/shared/ui/AppIcon.vue";

const { t } = useI18n();

const currentTask = computed(() => {
  const id = getCurrentTaskId().value;
  if (!id) return null;
  return getDownloadTasks().get(id) || null;
});

const isActive = computed(() => {
  const task = currentTask.value;
  return task != null && (task.status === "downloading" || task.status === "pending");
});

const isError = computed(() => currentTask.value?.status === "error");

const show = computed(() => currentTask.value != null && (isActive.value || isError.value));
</script>

<template>
  <Transition name="cp-toast">
    <div v-if="show && currentTask" class="cp-downloadToast" :class="{ 'cp-downloadToast--error': isError }">
      <span class="cp-downloadToast__icon">
        <AppIcon :name="isError ? 'close-circle' : 'download'" :size="14" />
      </span>
      <span class="cp-downloadToast__text">
        {{ isError ? t("download_failed") : t("file_downloading") }}
      </span>
      <span v-if="!isError" class="cp-downloadToast__progress">{{ currentTask.progress }}%</span>
      <div v-if="!isError" class="cp-downloadToast__bar">
        <div class="cp-downloadToast__fill" :style="{ width: currentTask.progress + '%' }" />
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
/* 样式：下载进度提示｜规格：玻璃胶囊 + accent 进度 + danger 失败态 token */
.cp-downloadToast {
  @include cp-glass-panel(999px, var(--cp-shadow-float));

  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 220px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  font-size: 12px;
  z-index: 9500;
}

/* 失败态：danger 状态色（文字/图标/描边/底色） */
.cp-downloadToast--error {
  border-color: var(--cp-danger-border);
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-surface));
}

.cp-downloadToast__icon {
  display: inline-flex;
  align-items: center;
  color: var(--cp-accent);
}

.cp-downloadToast--error .cp-downloadToast__icon {
  color: var(--cp-danger);
}

.cp-downloadToast__text {
  color: var(--cp-text);
  white-space: nowrap;
}

.cp-downloadToast--error .cp-downloadToast__text {
  color: var(--cp-danger);
}

.cp-downloadToast__progress {
  min-width: 32px;
  font-family: var(--cp-font-mono);
  font-size: 11.5px;
  color: var(--cp-text-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.cp-downloadToast__bar {
  width: 64px;
  height: 4px;
  border-radius: 999px;
  background: var(--cp-border-light);
  overflow: hidden;
}

.cp-downloadToast__fill {
  height: 100%;
  border-radius: 999px;
  background: var(--cp-accent);
  transition: width var(--cp-slow) var(--cp-ease);
}

/* Transition：淡入 + 轻微上移 */
.cp-toast-enter-active,
.cp-toast-leave-active {
  transition:
    opacity var(--cp-fast) var(--cp-ease),
    transform var(--cp-fast) var(--cp-ease);
}

.cp-toast-enter-from,
.cp-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
