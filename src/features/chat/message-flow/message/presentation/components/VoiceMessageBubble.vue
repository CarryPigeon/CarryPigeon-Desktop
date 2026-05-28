<script setup lang="ts">
/**
 * @fileoverview VoiceMessageBubble.vue
 * @description
 * message-flow/message｜语音消息播放气泡组件。
 * - 通过 shareKey 从服务器加载音频文件
 * - 显示录制时长
 * - 使用原生 <audio> 播放
 */

import { computed, ref } from "vue";
import { buildFileDownloadUrl } from "@/shared/file-transfer/buildFileDownloadUrl";
import { getActiveChatServerSocket } from "@/features/chat/composition/serverWorkspaceAdapter";

const props = defineProps<{
  /**
   * 文件 share key（上传后由服务器返回）。
   */
  shareKey: string;
  /**
   * 录制时长（毫秒）。
   */
  durationMs: number;
}>();

/**
 * 构建音频下载 URL。
 */
const audioUrl = computed(() => {
  if (!props.shareKey) return "";
  return buildFileDownloadUrl(getActiveChatServerSocket(), props.shareKey);
});

/**
 * 格式化时长（mm:ss）。
 */
function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

const isPlaying = ref(false);

function onPlay(): void {
  isPlaying.value = true;
}

function onPause(): void {
  isPlaying.value = false;
}

function onEnded(): void {
  isPlaying.value = false;
}
</script>

<template>
  <div
    class="cp-voiceBubble"
    :class="{ 'cp-voiceBubble--playing': isPlaying }"
  >
    <audio
      v-if="audioUrl"
      :src="audioUrl"
      controls
      preload="metadata"
      class="cp-voiceBubble__audio"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
    >
      Your browser does not support the audio element.
    </audio>
    <span v-else class="cp-voiceBubble__error">音频不可用</span>
    <span class="cp-voiceBubble__duration">{{ formatDuration(props.durationMs) }}</span>
  </div>
</template>

<style scoped lang="scss">
.cp-voiceBubble {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 280px;
  background: color-mix(in oklab, var(--cp-accent, #666) 10%, var(--cp-panel, #fff));
  border: 1px solid var(--cp-border-light, #e5e7eb);
  border-radius: 18px 18px 18px 4px;
  padding: 6px 12px;
  transition: background-color var(--cp-fast, 0.15s) var(--cp-ease, ease);

  &--playing {
    background: color-mix(in oklab, var(--cp-accent, #666) 18%, var(--cp-panel, #fff));
  }

  &__audio {
    height: 40px;
    border-radius: 8px;
    flex: 1;
    min-width: 160px;

    &::-webkit-media-controls-panel {
      background: transparent;
    }
  }

  &__duration {
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    color: var(--cp-text-muted, #888);
    white-space: nowrap;
    flex-shrink: 0;
  }

  &__error {
    font-size: 12px;
    color: var(--cp-danger, #e53935);
  }
}
</style>
