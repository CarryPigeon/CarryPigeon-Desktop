<template>
  <Transition name="voice-panel-slide">
    <div v-if="visible" class="voice-call-panel" :class="{ 'is-minimized': minimized }">
      <div class="voice-call-panel__bar" @click="minimized = !minimized">
        <span class="voice-call-panel__status">
          <span class="voice-call-panel__dot" :class="{ 'is-active': state === 'active', 'is-connecting': state === 'connecting' }"></span>
          {{ state === "connecting" ? "正在连接..." : state === "active" ? `通话中 · ${formattedDuration}` : state }}
        </span>
        <span v-if="state === 'active'" class="voice-call-panel__participant-count">
          {{ participants.length }} 人
        </span>
        <span class="voice-call-panel__toggle">{{ minimized ? "▲" : "▼" }}</span>
      </div>

      <div v-if="!minimized" class="voice-call-panel__controls">
        <button
          class="voice-call-panel__ctrl-btn"
          :class="{ 'is-muted': isMuted }"
          :title="isMuted ? '取消静音' : '静音'"
          @click="$emit('toggleMute')"
        >
          {{ isMuted ? "🔇" : "🎤" }}
        </button>
        <button
          class="voice-call-panel__ctrl-btn"
          :class="{ 'is-off': !isNoiseSuppressionOn }"
          :title="isNoiseSuppressionOn ? '关闭降噪' : '开启降噪'"
          @click="$emit('toggleNoiseSuppression')"
        >
          🔇
        </button>
        <select
          v-if="inputDevices.length > 0"
          class="voice-call-panel__device-select"
          :value="currentInputDeviceId"
          @change="$emit('selectInputDevice', ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="device in inputDevices"
            :key="device.deviceId"
            :value="device.deviceId"
          >
            {{ device.name }}
          </option>
        </select>
        <button
          class="voice-call-panel__ctrl-btn voice-call-panel__ctrl-btn--hangup"
          title="挂断"
          @click="$emit('hangup')"
        >
          ❌
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { CallState, AudioDeviceInfo, CallParticipant } from "../../domain/contracts";

const props = defineProps<{
  state: CallState;
  duration: number;
  participants: readonly CallParticipant[];
  isMuted: boolean;
  isNoiseSuppressionOn: boolean;
  inputDevices: readonly AudioDeviceInfo[];
  currentInputDeviceId: string | null;
}>();

defineEmits<{
  toggleMute: [];
  toggleNoiseSuppression: [];
  selectInputDevice: [deviceId: string];
  hangup: [];
}>();

const minimized = ref(false);

const visible = computed(() => props.state === "connecting" || props.state === "active");

const formattedDuration = computed(() => {
  const totalSec = Math.floor(props.duration / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
});
</script>

<style scoped lang="scss">
.voice-call-panel {
  border-top: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-container);
  overflow: hidden;

  &__bar {
    display: flex;
    align-items: center;
    height: 48px;
    padding: 0 16px;
    gap: 8px;
    cursor: pointer;
    user-select: none;

    &:hover {
      background: var(--td-bg-color-component-hover);
    }
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--td-text-color-primary);
    flex: 1;
    min-width: 0;
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--td-gray-color-5);
    flex-shrink: 0;

    &.is-active {
      background: var(--td-success-color);
      animation: blink 1.5s ease-in-out infinite;
    }

    &.is-connecting {
      background: var(--td-warning-color);
      animation: blink 0.8s ease-in-out infinite;
    }
  }

  &__participant-count {
    font-size: 12px;
    color: var(--td-text-color-secondary);
  }

  &__toggle {
    font-size: 10px;
    color: var(--td-text-color-placeholder);
  }

  &__controls {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    gap: 8px;
    border-top: 1px solid var(--td-border-level-2-color);
  }

  &__ctrl-btn {
    width: 36px;
    height: 36px;
    border: 1px solid var(--td-border-level-1-color);
    border-radius: 50%;
    background: var(--td-bg-color-component);
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      background: var(--td-bg-color-component-hover);
    }

    &.is-muted {
      background: var(--td-warning-color);
      border-color: var(--td-warning-color);
    }

    &.is-off {
      background: var(--td-error-color);
      border-color: var(--td-error-color);
      color: #fff;
    }

    &--hangup {
      margin-left: auto;
      border-color: var(--td-error-color);
      color: var(--td-error-color);

      &:hover {
        background: var(--td-error-color);
        color: #fff;
      }
    }
  }

  &__device-select {
    padding: 4px 8px;
    border: 1px solid var(--td-border-level-1-color);
    border-radius: 4px;
    font-size: 12px;
    background: var(--td-bg-color-container);
    color: var(--td-text-color-primary);
    max-width: 120px;
  }
}

.voice-panel-slide-enter-active,
.voice-panel-slide-leave-active {
  transition: all 0.3s ease;
}

.voice-panel-slide-enter-from,
.voice-panel-slide-leave-to {
  transform: translateY(100%);
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
