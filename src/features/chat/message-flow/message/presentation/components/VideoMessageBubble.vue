<template>
  <div class="video-message-bubble">
    <!-- 视频播放器 -->
    <div class="video-container" @click="handleOpenLightbox">
      <video
        ref="videoRef"
        :src="props.url"
        :poster="props.thumbUrl"
        class="message-video"
        :style="{ maxHeight: '300px', maxWidth: '100%' }"
        preload="metadata"
        controls
        playsinline
        @loadedmetadata="onLoadedMetadata"
        @error="onVideoError"
      />
      <!-- 点击放大提示 -->
      <div class="video-expand-hint">
        <span>⛶</span>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-if="loadState === 'error'" class="video-error">
      <div class="error-content">
        <div class="error-icon"><t-icon name="error-circle" size="24" /></div>
        <p class="error-message">{{ t("video_load_failed") }}</p>
        <button v-if="retryCount < maxRetries" @click="retryLoad" class="retry-button">
          {{ t("retry") }} ({{ retryCount + 1 }}/{{ maxRetries }})
        </button>
      </div>
    </div>

    <!-- 文件名栏 -->
    <div class="video-filebar">
      <span class="video-filename">{{ props.fileName }}</span>
      <span class="video-filesize">{{ formatFileSize(props.fileSize) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
  url: string;
  thumbUrl?: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (event: "openLightbox", payload: { url: string; fileName: string; isVideo: boolean }): void;
}>();

const { t } = useI18n();

const videoRef = ref<HTMLVideoElement>();
const loadState = ref<"loading" | "loaded" | "error">("loading");
const retryCount = ref(0);
const maxRetries = 3;

/**
 * 格式化文件大小。
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function onLoadedMetadata(): void {
  loadState.value = "loaded";
}

function onVideoError(): void {
  loadState.value = "error";
}

function handleOpenLightbox(): void {
  emit("openLightbox", {
    url: props.url,
    fileName: props.fileName,
    isVideo: true,
  });
}

function retryLoad(): void {
  if (retryCount.value >= maxRetries) return;
  retryCount.value++;
  loadState.value = "loading";
  if (videoRef.value) {
    videoRef.value.load();
  }
}

onMounted(() => {
  if (props.duration != null) {
    loadState.value = "loaded";
  }
});
</script>

<style scoped>
.video-message-bubble {
  display: inline-block;
  max-width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.2);
}

.video-container {
  position: relative;
  cursor: pointer;
}

.message-video {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 8px 8px 0 0;
  background: #000;
}

.video-expand-hint {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.video-container:hover .video-expand-hint {
  opacity: 1;
}

.video-error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  background: rgba(255, 0, 0, 0.1);
}

.error-content {
  text-align: center;
  padding: 16px;
}

.error-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cp-danger);
  margin-bottom: 8px;
}

.error-message {
  color: rgba(255, 255, 255, 0.7);
  margin: 6px 0;
  font-size: 13px;
}

.retry-button {
  background: rgba(59, 130, 246, 0.8);
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.retry-button:hover {
  background: rgba(59, 130, 246, 1);
}

.video-filebar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.3);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  border-radius: 0 0 8px 8px;
}

.video-filename {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}

.video-filesize {
  flex-shrink: 0;
  font-family: monospace;
}
</style>
