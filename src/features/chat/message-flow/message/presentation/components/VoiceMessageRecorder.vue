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
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import AppIcon from "@/shared/ui/AppIcon.vue";

const { t } = useI18n();

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
    await invoke(TAURI_COMMANDS.startVoiceRecording);
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
      TAURI_COMMANDS.stopVoiceRecording,
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
  if (state.value === "recording") {
    state.value = "idle";
    void invoke(TAURI_COMMANDS.stopVoiceRecording).catch(() => {
      // 卸载时尽力停止录音，避免输入设备占用泄漏
    });
  }
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
    :title="state === 'idle' ? t('voice_record_start') : state === 'recording' ? t('voice_record_stop') : t('voice_record_processing')"
    :aria-label="state === 'idle' ? t('voice_record_start') : state === 'recording' ? t('voice_record_stop') : t('voice_record_processing')"
    @click="toggleRecording"
  >
    <AppIcon v-if="state === 'idle'" name="microphone" class="cp-voiceRecorder__icon" />
    <AppIcon v-else-if="state === 'recording'" name="microphone" class="cp-voiceRecorder__icon cp-voiceRecorder__icon--recording" />
    <AppIcon v-else name="loading" class="cp-voiceRecorder__icon" />
    <span v-if="state === 'recording'" class="cp-voiceRecorder__timer">
      {{ formatDuration(elapsedMs) }}
    </span>
  </button>
</template>

<style scoped lang="scss">
/* 样式：VoiceMessageRecorder｜规格：胶囊按钮（hover 只变色），录制/处理用状态 token */
.cp-voiceRecorder {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);

  &:hover:not(:disabled) {
    background: var(--cp-hover-bg);
    border-color: var(--cp-highlight-border);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--recording {
    border-color: var(--cp-danger-border);
    background: var(--cp-danger-bg);
  }

  &--processing {
    border-color: var(--cp-warn-border);
    background: var(--cp-warn-bg);
  }

  &__icon {
    font-size: 16px;
    line-height: 1;

    &--recording {
      color: var(--cp-danger);
    }
  }

  &__timer {
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    min-width: 4ch;
    display: inline-block;
    text-align: center;
  }
}
</style>
