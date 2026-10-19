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
        <span><AppIcon name="maximize" /></span>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-if="loadState === 'error'" class="video-error">
      <div class="error-content">
        <div class="error-icon"><AppIcon name="error-circle" :size="24" /></div>
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
import AppIcon from "@/shared/ui/AppIcon.vue";

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

<style scoped lang="scss">
/* 样式：VideoMessageBubble｜规格：媒体卡片（卡片圆角 + 面板底/细边框），错误/文件名栏用 token */
.video-message-bubble {
  display: inline-block;
  max-width: 100%;
  border-radius: var(--cp-radius-card);
  overflow: hidden;
  background: var(--cp-panel-muted);
  border: 1px solid var(--cp-border-light);
}

.video-container {
  position: relative;
  cursor: pointer;
}

.message-video {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: var(--cp-radius-card) var(--cp-radius-card) 0 0;
  /* 视频画布固定黑色（媒体内容底色，不随主题变化） */
  background: #000;
}

/* 媒体上的放大提示：深色遮罩 + 白色图标为固定媒体层配色，不随主题变化 */
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
  transition: opacity var(--cp-fast) var(--cp-ease);
  pointer-events: none;
}

.video-container:hover .video-expand-hint {
  opacity: 1;
}

/* 错误态：danger 状态底 */
.video-error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  background: var(--cp-danger-bg);
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
  color: var(--cp-text);
  margin: 6px 0;
  font-size: 13px;
}

/* 重试：胶囊按钮（主操作语义用 highlight） */
.retry-button {
  @include cp-pill-button(primary);
}

.video-filebar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--cp-panel-muted);
  border-top: 1px solid var(--cp-border-light);
  font-size: 11px;
  color: var(--cp-text-muted);
  border-radius: 0 0 var(--cp-radius-card) var(--cp-radius-card);
}

.video-filename {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}

.video-filesize {
  flex-shrink: 0;
  font-family: var(--cp-font-mono);
}
</style>
