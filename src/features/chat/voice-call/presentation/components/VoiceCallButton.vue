<template>
  <button
    v-if="callState === 'idle' || callState === 'ended'"
    class="voice-call-button"
    :disabled="callState !== 'idle' && callState !== 'ended'"
    :title="conference ? '发起多人会议' : '发起语音通话'"
    @click="$emit('start')"
  >
    <span class="voice-call-icon">{{ conference ? '👥' : '📞' }}</span>
  </button>
</template>

<script setup lang="ts">
import type { CallState } from "../../domain/contracts";

defineProps<{
  callState: CallState;
  conference?: boolean;
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
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: var(--td-text-color-primary);
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background-color: var(--td-bg-color-component-hover);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .voice-call-icon {
    font-size: 18px;
    line-height: 1;
  }
}
</style>
