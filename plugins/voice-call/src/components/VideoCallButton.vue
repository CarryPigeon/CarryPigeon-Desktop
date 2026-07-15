<template>
  <button
    class="voice-call-button"
    :disabled="callState !== 'idle' && callState !== 'ended'"
    :title="t('video_call')"
    @click="$emit('start')"
  >
    <t-icon name="camera" class="voice-call-icon" />
  </button>
</template>

<script setup lang="ts">
import type { CallState } from "../domain/contracts";
import { t } from "../i18n";

defineProps<{
  callState: CallState;
}>();

defineEmits<{
  start: [];
}>();
</script>

<style scoped lang="scss">
.voice-call-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--cp-border);
  border-radius: 999px;
  background: var(--cp-panel-muted);
  cursor: pointer;
  color: var(--cp-text);
  padding: 8px 12px;
  font-size: 14px;
  transition: transform 0.15s ease, background-color 0.15s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    background: var(--cp-hover-bg);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .voice-call-icon {
    font-size: 16px;
    line-height: 1;
  }
}
</style>
