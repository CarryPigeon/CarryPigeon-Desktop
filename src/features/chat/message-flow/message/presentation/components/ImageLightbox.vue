<script setup lang="ts">
/**
 * @fileoverview ImageLightbox.vue
 * @description chat/message-flow/message｜全屏图片灯箱组件：支持导航、缩放、拖拽平移、旋转、下载。
 */

import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useFocusTrap } from "@/shared/utils/useFocusTrap";
import { createLogger } from "@/shared/utils/logger";
import AppIcon from "@/shared/ui/AppIcon.vue";

const logger = createLogger("ImageLightbox");
const { t } = useI18n();

const props = defineProps<{
  /**
   * 图片/视频列表。
   */
  images: { url: string; fileName: string; isVideo?: boolean }[];
  /**
   * 初始展示的图片索引。
   */
  initialIndex: number;
}>();

const emit = defineEmits<{
  /**
   * 关闭灯箱。
   */
  (e: "close"): void;
}>();

/** 当前图片索引。 */
const currentIndex = ref(props.initialIndex);

/** 缩放倍率。 */
const scale = ref(1);

/** 拖拽偏移。 */
const panX = ref(0);
const panY = ref(0);

/** 是否正在拖拽。 */
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const dragLastX = ref(0);
const dragLastY = ref(0);

/** 旋转角度（0 | 90 | 180 | 270）。 */
const rotation = ref(0);

/** 下载进行中状态。 */
const isDownloading = ref(false);

/** 下载 blob URL 列表（组件卸载时统一撤销）。 */
const blobUrls: string[] = [];

const currentImage = computed(() => props.images[currentIndex.value] ?? null);
const totalCount = computed(() => props.images.length);
const hasPrev = computed(() => currentIndex.value > 0);
const hasNext = computed(() => currentIndex.value < totalCount.value - 1);
const counterText = computed(() => `${currentIndex.value + 1} / ${totalCount.value}`);

/** 当前媒体是否为视频（优先使用传入的 isVideo 标记，回退到文件名后缀判断）。 */
const isVideo = computed(() => {
  if (currentImage.value?.isVideo != null) return currentImage.value.isVideo;
  const name = currentImage.value?.fileName ?? "";
  return /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(name);
});

/**
 * 关闭灯箱。
 */
function close(): void {
  emit("close");
}

/**
 * 上一张。
 */
function prev(): void {
  if (!hasPrev.value) return;
  currentIndex.value--;
  resetView();
}

/**
 * 下一张。
 */
function next(): void {
  if (!hasNext.value) return;
  currentIndex.value++;
  resetView();
}

/**
 * 重置缩放、平移和旋转。
 */
function resetView(): void {
  resetZoom();
  rotation.value = 0;
}

/**
 * 重置缩放和平移。
 */
function resetZoom(): void {
  scale.value = 1;
  panX.value = 0;
  panY.value = 0;
}

/**
 * 顺时针旋转 90°。
 */
function rotateClockwise(): void {
  rotation.value = ((rotation.value + 90) % 360) as 0 | 90 | 180 | 270;
}

/**
 * 下载当前图片。
 * 使用 fetch + Blob 方式兼容跨域图片下载。
 */
async function downloadImage(): Promise<void> {
  if (!currentImage.value?.url || isDownloading.value) return;

  isDownloading.value = true;
  try {
    const response = await fetch(currentImage.value.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    blobUrls.push(blobUrl);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = currentImage.value.fileName || "image";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    logger.info("Action: chat_lightbox_download_image", {
      fileName: currentImage.value.fileName,
    });
  } catch (err) {
    logger.error("Action: chat_lightbox_download_failed", {
      error: String(err),
    });
    // 降级：通过 <a> 元素打开原始链接（不受弹窗拦截器限制）。
    if (currentImage.value?.url) {
      const a = document.createElement("a");
      a.href = currentImage.value.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } finally {
    isDownloading.value = false;
  }
}

/**
 * 滚轮缩放。
 *
 * @param e - WheelEvent。
 */
function handleWheel(e: WheelEvent): void {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 0.1 : -0.1;
  const prevScale = scale.value;
  const next = Math.min(3, Math.max(0.5, scale.value + delta));
  scale.value = Math.round(next * 10) / 10;
  // 缩放后把偏移也等比例缩小，避免飞出边界
  panX.value = panX.value * (scale.value / prevScale);
  panY.value = panY.value * (scale.value / prevScale);
}

/**
 * 开始拖拽。
 *
 * @param e - MouseEvent。
 */
function startDrag(e: MouseEvent): void {
  if (scale.value <= 1) return;
  isDragging.value = true;
  dragStartX.value = e.clientX;
  dragStartY.value = e.clientY;
  dragLastX.value = panX.value;
  dragLastY.value = panY.value;
}

/**
 * 拖拽移动。
 *
 * @param e - MouseEvent。
 */
function onDrag(e: MouseEvent): void {
  if (!isDragging.value) return;
  const dx = e.clientX - dragStartX.value;
  const dy = e.clientY - dragStartY.value;
  panX.value = dragLastX.value + dx;
  panY.value = dragLastY.value + dy;
}

/**
 * 结束拖拽。
 */
function stopDrag(): void {
  isDragging.value = false;
}

/**
 * 点击背景关闭。
 *
 * @param e - MouseEvent。
 */
function onBackdropClick(e: MouseEvent): void {
  if ((e.target as HTMLElement).classList.contains("cp-lightbox__backdrop")) {
    close();
  }
}

/**
 * 键盘事件处理。
 *
 * @param e - KeyboardEvent。
 */
function handleKeydown(e: KeyboardEvent): void {
  switch (e.key) {
    case "Escape":
      close();
      break;
    case "ArrowLeft":
      prev();
      break;
    case "ArrowRight":
      next();
      break;
    case "r":
    case "R":
      rotateClockwise();
      break;
  }
}

/** 保存 body 原始 overflow 值。 */
let originalBodyOverflow = "";

/** 灯箱容器 ref，用于 focus trap。 */
const backdropRef = ref<HTMLElement | null>(null);
const { trapFocus, releaseFocus } = useFocusTrap(backdropRef);

onMounted(() => {
  originalBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  window.addEventListener("keydown", handleKeydown);
  trapFocus();
});

onUnmounted(() => {
  blobUrls.forEach((url) => URL.revokeObjectURL(url));
  blobUrls.length = 0;
  document.body.style.overflow = originalBodyOverflow;
  window.removeEventListener("keydown", handleKeydown);
  releaseFocus();
});

// 当 images 或 initialIndex 变化时同步
watch(
  () => props.initialIndex,
  (idx) => {
    currentIndex.value = idx;
    resetView();
  },
);
</script>

<template>
  <!-- 组件：ImageLightbox｜职责：全屏图片灯箱 -->
  <Teleport to="body">
    <div
      ref="backdropRef"
      class="cp-lightbox__backdrop"
      @click="onBackdropClick"
      @mousemove="onDrag"
      @mouseup="stopDrag"
      @mouseleave="stopDrag"
    >
      <!-- 顶部栏 -->
      <div class="cp-lightbox__topBar">
        <span class="cp-lightbox__filename">{{
          currentImage?.fileName ?? ""
        }}</span>
        <span class="cp-lightbox__counter">{{ counterText }}</span>
        <div class="cp-lightbox__topActions">
          <button
            v-if="!isVideo"
            class="cp-lightbox__actionBtn"
            type="button"
            aria-label="Rotate"
            title="Rotate 90°"
            @click="rotateClockwise"
          >
            <t-icon name="refresh" />
          </button>
          <button
            v-if="currentImage?.url"
            class="cp-lightbox__actionBtn"
            type="button"
            :aria-label="'Download'"
            :title="'Download'"
            :disabled="isDownloading"
            @click="downloadImage"
          >
            <t-icon :name="isDownloading ? 'loading' : 'download'" />
          </button>
          <button
            class="cp-lightbox__closeBtn"
            type="button"
            aria-label="Close lightbox"
            @click="close"
          >
            <t-icon name="close" />
          </button>
        </div>
      </div>

      <!-- 主体图片区域 -->
      <div class="cp-lightbox__body">
        <!-- 左箭头 -->
        <button
          v-if="hasPrev"
          class="cp-lightbox__arrow cp-lightbox__arrow--left"
          type="button"
          aria-label="Previous image"
          @click="prev"
        >
          <t-icon name="chevron-left" />
        </button>

        <!-- 媒体容器 -->
        <div class="cp-lightbox__imageWrap">
          <!-- 视频播放器 -->
          <video
            v-if="currentImage && isVideo"
            :key="`video-${currentIndex}`"
            :src="currentImage.url"
            class="cp-lightbox__image cp-lightbox__video"
            controls
            autoplay
            playsinline
            loop
          />
          <!-- 图片 -->
          <img
            v-else-if="currentImage"
            :key="`img-${currentIndex}`"
            :src="currentImage.url"
            :alt="currentImage.fileName"
            class="cp-lightbox__image"
            :style="{
              transform: `translate(${panX}px, ${panY}px) scale(${scale}) rotate(${rotation}deg)`,
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            }"
            @mousedown="startDrag"
            @wheel.prevent="handleWheel"
            draggable="false"
          />
        </div>

        <!-- 右箭头 -->
        <button
          v-if="hasNext"
          class="cp-lightbox__arrow cp-lightbox__arrow--right"
          type="button"
          aria-label="Next image"
          @click="next"
        >
          <t-icon name="chevron-right" />
        </button>
      </div>

      <!-- 底部缩略图条 -->
      <div v-if="totalCount > 1" class="cp-lightbox__thumbStrip">
        <button
          v-for="(img, idx) in images"
          :key="idx"
          class="cp-lightbox__thumbItem"
          :class="{ 'cp-lightbox__thumbItem--active': idx === currentIndex }"
          type="button"
          @click="currentIndex = idx; resetView()"
        >
          <img
            :src="img.url"
            :alt="img.fileName"
            class="cp-lightbox__thumbImg"
          />
        </button>
      </div>

      <!-- 底部提示栏 -->
      <div class="cp-lightbox__hintBar">
        <template v-if="isVideo">
          <span><AppIcon name="play" :size="11" :stroke-width="2" /> {{ t("video_playing") }}</span>
          <span><AppIcon name="arrow-left-key" :size="11" :stroke-width="2" /> <AppIcon name="arrow-right-key" :size="11" :stroke-width="2" /> {{ t("navigate") }}</span>
        </template>
        <template v-else>
          <span><AppIcon name="circle-dot" :size="11" :stroke-width="2" /> {{ t("scroll_to_zoom") }}</span>
          <span><AppIcon name="hand" :size="11" :stroke-width="2" /> {{ t("drag_to_pan") }}</span>
          <span><AppIcon name="rotate-cw" :size="11" :stroke-width="2" /> {{ t("r_to_rotate") }}</span>
          <span><AppIcon name="arrow-left-key" :size="11" :stroke-width="2" /> <AppIcon name="arrow-right-key" :size="11" :stroke-width="2" /> {{ t("navigate") }}</span>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.cp-lightbox__backdrop {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  flex-direction: column;
  user-select: none;
}

/* 顶部栏 */
.cp-lightbox__topBar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), transparent);
  color: #fff;
  font-size: 14px;
}

.cp-lightbox__filename {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-lightbox__counter {
  font-family: var(--cp-font-mono, monospace);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.cp-lightbox__topActions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cp-lightbox__actionBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  transition: background 120ms ease;
}

.cp-lightbox__actionBtn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.25);
}

.cp-lightbox__actionBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cp-lightbox__closeBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  transition: background 120ms ease;
}

.cp-lightbox__closeBtn:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* 主体区域 */
.cp-lightbox__body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.cp-lightbox__imageWrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.cp-lightbox__image {
  display: block;
  max-width: 90vw;
  max-height: 80vh;
  object-fit: contain;
  transition: transform 200ms ease;
  will-change: transform;
}

.cp-lightbox__video {
  width: auto;
  height: auto;
  outline: none;
}

/* 左右箭头 */
.cp-lightbox__arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 24px;
  width: 48px;
  height: 80px;
  display: grid;
  place-items: center;
  cursor: pointer;
  border-radius: 8px;
  transition: background 120ms ease;
}

.cp-lightbox__arrow:hover {
  background: rgba(255, 255, 255, 0.2);
}

.cp-lightbox__arrow--left {
  left: 12px;
}

.cp-lightbox__arrow--right {
  right: 12px;
}

/* 底部缩略图条 */
.cp-lightbox__thumbStrip {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent);
  overflow-x: auto;
}

.cp-lightbox__thumbItem {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  background: transparent;
  transition: border-color 120ms ease, opacity 120ms ease;
  opacity: 0.6;
}

.cp-lightbox__thumbItem--active {
  border-color: #fff;
  opacity: 1;
}

.cp-lightbox__thumbItem:hover {
  opacity: 0.9;
}

.cp-lightbox__thumbImg {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 底部操作提示栏 */
.cp-lightbox__hintBar {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 16px;
  padding: 6px 16px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 300ms ease;
  align-items: center;
}

.cp-lightbox__hintBar span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cp-lightbox__backdrop:hover .cp-lightbox__hintBar {
  opacity: 1;
}
</style>
