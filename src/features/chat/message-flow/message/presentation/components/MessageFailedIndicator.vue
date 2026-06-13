<script setup lang="ts">
/**
 * @fileoverview MessageFailedIndicator.vue
 * @description 消息发送失败指示器和重试/删除按钮。
 */
defineProps<{
  messageId: string;
  error?: string;
}>();

const emit = defineEmits<{
  (event: "retry", messageId: string): void;
  (event: "remove", messageId: string): void;
}>();
</script>

<template>
  <div class="cp-failedIndicator">
    <span class="cp-failedIndicator__icon">⚠️</span>
    <span class="cp-failedIndicator__text">{{ error || $t("send_failed") }}</span>
    <button class="cp-failedIndicator__btn" @click="emit('retry', messageId)">
      {{ $t("retry") }}
    </button>
    <button class="cp-failedIndicator__dismiss" @click="emit('remove', messageId)">
      ✕
    </button>
  </div>
</template>

<style scoped lang="scss">
.cp-failedIndicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  margin-top: 4px;
  background: color-mix(in oklab, var(--cp-danger) 12%, var(--cp-panel));
  border: 1px solid color-mix(in oklab, var(--cp-danger) 24%, var(--cp-border));
  border-radius: 8px;
  font-size: 11px;
  color: var(--cp-text);
}
.cp-failedIndicator__icon {
  flex-shrink: 0;
}
.cp-failedIndicator__text {
  color: var(--cp-text-muted);
  flex: 1;
}
.cp-failedIndicator__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  color: var(--cp-text);
  white-space: nowrap;
}
.cp-failedIndicator__btn:hover {
  background: var(--cp-hover-bg);
}
.cp-failedIndicator__dismiss {
  border: none;
  background: transparent;
  color: var(--cp-text-muted);
  cursor: pointer;
  padding: 0 2px;
  font-size: 11px;
}
</style>
