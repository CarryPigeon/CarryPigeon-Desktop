<script setup lang="ts">
/**
 * @fileoverview DownloadProgressToast.vue
 * @description files｜下载进度提示组件。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { getDownloadTasks, getCurrentTaskId } from "@/shared/file-transfer/downloadStore";

const { t } = useI18n();

const currentTask = computed(() => {
  const id = getCurrentTaskId().value;
  if (!id) return null;
  return getDownloadTasks().get(id) || null;
});

const show = computed(() => currentTask.value != null && (currentTask.value.status === "downloading" || currentTask.value.status === "pending"));
</script>

<template>
  <Transition name="cp-toast">
    <div v-if="show && currentTask" class="cp-downloadToast">
      <span class="cp-downloadToast__icon">⬇</span>
      <span class="cp-downloadToast__text">{{ t("file_downloading") }}</span>
      <span class="cp-downloadToast__progress">{{ currentTask.progress }}%</span>
      <div class="cp-downloadToast__bar">
        <div class="cp-downloadToast__fill" :style="{ width: currentTask.progress + '%' }" />
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.cp-downloadToast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 999px;
  padding: 10px 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: var(--cp-shadow-strong);
  z-index: 9500;
  font-size: 12px;
  min-width: 200px;
}

.cp-downloadToast__icon {
  font-size: 14px;
}

.cp-downloadToast__text {
  color: var(--cp-text);
  white-space: nowrap;
}

.cp-downloadToast__progress {
  color: var(--cp-text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 32px;
  text-align: right;
}

.cp-downloadToast__bar {
  width: 60px;
  height: 4px;
  background: var(--cp-panel-muted);
  border-radius: 2px;
  overflow: hidden;
}

.cp-downloadToast__fill {
  height: 100%;
  background: var(--cp-accent, #3b82f6);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.cp-toast-enter-active,
.cp-toast-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.cp-toast-enter-from,
.cp-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
