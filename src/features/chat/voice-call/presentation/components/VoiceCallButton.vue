<template>
  <button
    v-if="callState === 'idle' || callState === 'dialing' || callState === 'ended'"
    class="voice-call-button"
    :class="{ 'is-loading': callState === 'dialing' }"
    :disabled="callState !== 'idle' && callState !== 'ended'"
    :title="'发起语音通话'"
    @click="$emit('start')"
  >
    <span class="voice-call-icon">{{ callState === 'dialing' ? '⏳' : '📞' }}</span>
  </button>
</template>

<script setup lang="ts">
import type { CallState } from "../../domain/contracts";

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

  &.is-loading .voice-call-icon {
    animation: pulse 1s infinite;
  }

  .voice-call-icon {
    font-size: 18px;
    line-height: 1;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
