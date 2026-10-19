<script setup lang="ts">
import AppIcon from "@/shared/ui/AppIcon.vue";
/**
 * @fileoverview MessageFailedIndicator.vue
 * @description 消息发送失败指示器和重试按钮。
 */
defineProps<{
  messageId: string;
  error?: string;
}>();

const emit = defineEmits<{
  (event: "retry", messageId: string): void;
}>();
</script>

<template>
  <div class="cp-failedIndicator">
    <span class="cp-failedIndicator__icon"><AppIcon name="error-circle" /></span>
    <span class="cp-failedIndicator__text">{{ error || $t("send_failed") }}</span>
    <button class="cp-failedIndicator__btn" @click="emit('retry', messageId)">
      {{ $t("retry") }}
    </button>
  </div>
</template>

<style scoped lang="scss">
/* 样式：MessageFailedIndicator｜规格：danger 状态条 + 胶囊重试按钮 */
.cp-failedIndicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  margin-top: 4px;
  background: var(--cp-danger-bg);
  border: 1px solid var(--cp-danger-border);
  border-radius: var(--cp-radius-sm);
  font-size: 11px;
  color: var(--cp-text);
}
.cp-failedIndicator__icon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--cp-danger);
  font-size: 14px;
}
.cp-failedIndicator__text {
  color: var(--cp-text-muted);
  flex: 1;
}
.cp-failedIndicator__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  color: var(--cp-text);
  white-space: nowrap;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}
.cp-failedIndicator__btn:hover {
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}
</style>
