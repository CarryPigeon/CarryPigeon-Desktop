<script setup lang="ts">
/**
 * @fileoverview ImageMessageBubble.vue
 * @description
 * message-flow/message｜图片消息气泡组件。
 * - 三态：loading（骨架屏+脉冲动画）、loaded（渲染图片）、error（重试按钮）
 * - 点击图片触发 openLightbox 事件
 * - 使用原生 Image 对象预加载后显示
 * - 遵循 --cp-* CSS 变量主题
 */
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  /** 图片直链 URL。 */
  url: string;
  /** 缩略图 URL（可选）。 */
  thumbUrl?: string;
  /** 文件名。 */
  fileName: string;
  /** 文件大小（字节）。 */
  fileSize: number;
  /** 图片宽度（可选）。 */
  width?: number;
  /** 图片高度（可选）。 */
  height?: number;
}>();

const emit = defineEmits<{
  (e: "openLightbox", payload: { url: string; filename: string }): void;
}>();

const { t } = useI18n();

/** 加载状态：loading / loaded / error */
type LoadState = "loading" | "loaded" | "error";
const loadState = ref<LoadState>("loading");

/** 预加载成功的图片自然尺寸，用于计算宽高比。 */
const naturalWidth = ref(0);
const naturalHeight = ref(0);

/**
 * 图片显示 URL：优先使用 thumbUrl，无缩略图时降级为 url。
 */
const displayUrl = computed(() => props.thumbUrl || props.url);

/**
 * 根据自然宽高或 props 宽高计算容器最大尺寸下的最佳显示尺寸。
 */
const displayWidth = computed(() => {
  if (naturalWidth.value > 0) return naturalWidth.value;
  if (props.width && props.width > 0) return props.width;
  return 360;
});

const displayHeight = computed(() => {
  if (naturalHeight.value > 0) return naturalHeight.value;
  if (props.height && props.height > 0) return props.height;
  return 0;
});

/**
 * 预加载图片：使用 Image 对象加载，加载完成前保持 loading 状态。
 */
function loadImage(src: string): void {
  loadState.value = "loading";
  naturalWidth.value = 0;
  naturalHeight.value = 0;

  const img = new Image();
  img.onload = () => {
    naturalWidth.value = img.naturalWidth;
    naturalHeight.value = img.naturalHeight;
    loadState.value = "loaded";
  };
  img.onerror = () => {
    loadState.value = "error";
  };
  img.src = src;
}

/** 点击图片时触发灯箱打开事件。 */
function handleImageClick(): void {
  if (loadState.value !== "loaded") return;
  emit("openLightbox", { url: props.url, filename: props.fileName });
}

/** 重试加载。 */
function handleRetry(): void {
  loadImage(displayUrl.value);
}

/** 根据 props 变化重新加载。 */
watch(() => displayUrl.value, (newUrl) => {
  if (newUrl) loadImage(newUrl);
});

onMounted(() => {
  if (displayUrl.value) loadImage(displayUrl.value);
});

/**
 * 格式化文件大小为可读字符串。
 */
function formatSize(bytes: number): string {
  if (bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const sizeLabel = computed(() => formatSize(props.fileSize));
</script>

<template>
  <div class="cp-imageBubble" :title="fileName">
    <!-- Loading 态：骨架屏 + 脉冲动画 -->
    <div
      v-if="loadState === 'loading'"
      class="cp-imageBubble__skeleton"
      :style="{
        width: displayWidth > 0 ? Math.min(displayWidth, 360) + 'px' : '200px',
        aspectRatio: displayHeight > 0 && displayWidth > 0
          ? String(displayWidth / displayHeight)
          : undefined,
      }"
    >
      <div class="cp-imageBubble__skeletonPulse" />
      <div class="cp-imageBubble__skeletonIcon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    </div>

    <!-- Loaded 态：渲染图片 -->
    <img
      v-else-if="loadState === 'loaded'"
      class="cp-imageBubble__image"
      :src="displayUrl"
      :alt="fileName"
      :width="displayWidth > 0 ? Math.min(displayWidth, 360) : undefined"
      :style="{
        cursor: 'pointer',
        aspectRatio: displayHeight > 0 && displayWidth > 0
          ? String(displayWidth / displayHeight)
          : undefined,
      }"
      @click="handleImageClick"
    />

    <!-- Error 态：显示错误提示与重试按钮 -->
    <div v-else class="cp-imageBubble__error">
      <svg class="cp-imageBubble__errorIcon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span class="cp-imageBubble__errorText">{{ t('image_load_failed', {}, '图片加载失败') }}</span>
      <button class="cp-imageBubble__retryBtn" @click="handleRetry">
        {{ t('retry', {}, '重试') }}
      </button>
    </div>

    <!-- 文件信息（尺寸和文件名） -->
    <div class="cp-imageBubble__info">
      <span class="cp-imageBubble__infoName">{{ fileName }}</span>
      <span v-if="sizeLabel" class="cp-imageBubble__infoSize">{{ sizeLabel }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cp-imageBubble {
  display: inline-flex;
  flex-direction: column;
  max-width: 360px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--cp-panel, #fff);
  border: 1px solid var(--cp-border-light, #e5e7eb);
  transition: box-shadow var(--cp-fast, 0.15s) var(--cp-ease, ease);

  &:hover {
    box-shadow: var(--cp-shadow-soft, 0 1px 4px rgba(0, 0, 0, 0.08));
  }

  /* ===== Loading 骨架屏 ===== */
  &__skeleton {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    max-height: 360px;
    overflow: hidden;
    background: var(--cp-bg-muted, #f0f0f0);
  }

  &__skeletonPulse {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in oklab, var(--cp-text, #333) 6%, transparent) 50%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: cp-imagePulse 1.5s ease-in-out infinite;
  }

  @keyframes cp-imagePulse {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  &__skeletonIcon {
    position: relative;
    z-index: 1;
    color: var(--cp-text-muted, #999);
    opacity: 0.5;
  }

  /* ===== Loaded 图片 ===== */
  &__image {
    display: block;
    width: 100%;
    max-height: 360px;
    object-fit: cover;
    border-radius: 0;
    user-select: none;
    -webkit-user-drag: none;
    transition: opacity var(--cp-fast, 0.15s) var(--cp-ease, ease);

    &:hover {
      opacity: 0.92;
    }
  }

  /* ===== Error 错误态 ===== */
  &__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px 16px;
    background: var(--cp-bg-muted, #f9f9f9);
    min-height: 120px;
  }

  &__errorIcon {
    color: var(--cp-danger, #e53935);
    opacity: 0.7;
  }

  &__errorText {
    font-size: 12px;
    color: var(--cp-text-muted, #888);
    text-align: center;
  }

  &__retryBtn {
    padding: 4px 16px;
    font-size: 12px;
    border-radius: 999px;
    border: 1px solid var(--cp-border-light, #e5e7eb);
    background: var(--cp-panel, #fff);
    color: var(--cp-text, #333);
    cursor: pointer;
    transition: background-color var(--cp-fast, 0.15s) var(--cp-ease, ease);

    &:hover {
      background: var(--cp-bg-muted, #f0f0f0);
    }
  }

  /* ===== 文件信息栏 ===== */
  &__info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    font-size: 11px;
    border-top: 1px solid var(--cp-border-light, #e5e7eb);
    background: var(--cp-panel, #fff);
  }

  &__infoName {
    color: var(--cp-text, #333);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  &__infoSize {
    color: var(--cp-text-muted, #888);
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
}
</style>
