<script setup lang="ts">
/**
 * @fileoverview VoiceMessageRecorder.vue
 * @description
 * message-flow/message｜语音消息录制按钮组件。
 * - 点击开始录制，再次点击停止录制
 * - 录制中显示红色脉冲动画和计时器
 * - 停止后触发 recorded 事件返回文件信息
 */

import { ref, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";

const props = withDefaults(defineProps<{
  /**
   * 禁用录制。
   */
  disabled?: boolean;
}>(), {
  disabled: false,
});

const emit = defineEmits<{
  (e: "recorded", payload: { filePath: string; durationMs: number; sizeBytes: number }): void;
  (e: "error", message: string): void;
}>();

type RecorderState = "idle" | "recording" | "processing";
const state = ref<RecorderState>("idle");
const elapsedMs = ref(0);
const maxDurationMs = 300_000; // 5 分钟上限
let timerHandle: ReturnType<typeof setInterval> | null = null;
let startTime = 0;

/**
 * 格式化时长（mm:ss）。
 */
function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/**
 * 开始录制。
 */
async function startRecording(): Promise<void> {
  try {
    state.value = "recording";
    startTime = Date.now();
    elapsedMs.value = 0;
    timerHandle = setInterval(() => {
      elapsedMs.value = Date.now() - startTime;
      if (elapsedMs.value >= maxDurationMs) {
        void stopRecording();
      }
    }, 100);
    await invoke("start_voice_recording");
  } catch (e) {
    state.value = "idle";
    cleanupTimer();
    emit("error", String(e));
  }
}

/**
 * 停止录制并获取结果。
 */
async function stopRecording(): Promise<void> {
  if (state.value !== "recording") return;
  state.value = "processing";
  cleanupTimer();
  try {
    const result = await invoke<{ file_path: string; duration_ms: number; size_bytes: number }>(
      "stop_voice_recording",
    );
    emit("recorded", {
      filePath: result.file_path,
      durationMs: result.duration_ms,
      sizeBytes: result.size_bytes,
    });
    state.value = "idle";
  } catch (e) {
    state.value = "idle";
    emit("error", String(e));
  }
}

/**
 * 切换录制状态。
 */
function toggleRecording(): void {
  if (state.value === "idle") {
    void startRecording();
  } else if (state.value === "recording") {
    void stopRecording();
  }
}

/**
 * 清理计时器。
 */
function cleanupTimer(): void {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}

onUnmounted(() => {
  cleanupTimer();
});
</script>

<template>
  <button
    type="button"
    class="cp-voiceRecorder"
    :class="{
      'cp-voiceRecorder--recording': state === 'recording',
      'cp-voiceRecorder--processing': state === 'processing',
    }"
    :disabled="state === 'processing' || props.disabled"
    :title="state === 'idle' ? '录制语音' : state === 'recording' ? '停止录制' : '处理中…'"
    @click="toggleRecording"
  >
    <span v-if="state === 'idle'" class="cp-voiceRecorder__icon">🎤</span>
    <span v-else-if="state === 'recording'" class="cp-voiceRecorder__icon cp-voiceRecorder__pulse">🔴</span>
    <span v-else class="cp-voiceRecorder__icon">⏳</span>
    <span v-if="state === 'recording'" class="cp-voiceRecorder__timer">
      {{ formatDuration(elapsedMs) }}
    </span>
  </button>
</template>

<style scoped lang="scss">
.cp-voiceRecorder {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 2px solid var(--cp-border, #d0d5dd);
  background: var(--cp-panel-muted, #f5f5f5);
  color: var(--cp-text, #1d1d1f);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  transition:
    border-color var(--cp-fast, 0.15s) var(--cp-ease, ease),
    background-color var(--cp-fast, 0.15s) var(--cp-ease, ease),
    transform var(--cp-fast, 0.15s) var(--cp-ease, ease);

  &:hover:enabled {
    transform: translateY(-1px);
    border-color: var(--cp-accent, #666);
    background: var(--cp-hover-bg, #eaeaea);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--recording {
    border-color: var(--cp-danger, #e53935);
    background: color-mix(in oklab, var(--cp-danger, #e53935) 12%, var(--cp-panel-muted, #f5f5f5));
    animation: cp-voiceRecorder-pulse 1.5s ease-in-out infinite;
  }

  &--processing {
    border-color: var(--cp-warning, #f59e0b);
    background: color-mix(in oklab, var(--cp-warning, #f59e0b) 12%, var(--cp-panel-muted, #f5f5f5));
  }

  &__icon {
    line-height: 1;
  }

  &__pulse {
    animation: cp-voiceRecorder-blink 1s ease-in-out infinite;
  }

  &__timer {
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    min-width: 4ch;
    display: inline-block;
    text-align: center;
  }
}

@keyframes cp-voiceRecorder-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 color-mix(in oklab, var(--cp-danger, #e53935) 40%, transparent);
  }
  50% {
    box-shadow: 0 0 0 6px color-mix(in oklab, var(--cp-danger, #e53935) 0%, transparent);
  }
}

@keyframes cp-voiceRecorder-blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
</style>
