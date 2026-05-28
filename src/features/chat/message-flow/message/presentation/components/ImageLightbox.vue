<script setup lang="ts">
/**
 * @fileoverview ImageLightbox.vue
 * @description chat/message-flow/message｜全屏图片灯箱组件：支持导航、缩放、拖拽平移。
 */

import { computed, onMounted, onUnmounted, ref, watch } from "vue";

const props = defineProps<{
  /**
   * 图片列表。
   */
  images: { url: string; filename: string }[];
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

const currentImage = computed(() => props.images[currentIndex.value] ?? null);
const totalCount = computed(() => props.images.length);
const hasPrev = computed(() => currentIndex.value > 0);
const hasNext = computed(() => currentIndex.value < totalCount.value - 1);
const counterText = computed(() => `${currentIndex.value + 1} / ${totalCount.value}`);

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
  resetZoom();
}

/**
 * 下一张。
 */
function next(): void {
  if (!hasNext.value) return;
  currentIndex.value++;
  resetZoom();
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
 * 滚轮缩放。
 *
 * @param e - WheelEvent。
 */
function handleWheel(e: WheelEvent): void {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 0.1 : -0.1;
  const next = Math.min(3, Math.max(0.5, scale.value + delta));
  scale.value = Math.round(next * 10) / 10;
  // 缩放后把偏移也等比例缩小，避免飞出边界
  panX.value = panX.value * (next / scale.value);
  panY.value = panY.value * (next / scale.value);
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
  }
}

/** 保存 body 原始 overflow 值。 */
let originalBodyOverflow = "";

onMounted(() => {
  originalBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  document.body.style.overflow = originalBodyOverflow;
  window.removeEventListener("keydown", handleKeydown);
});

// 当 images 或 initialIndex 变化时同步
watch(
  () => props.initialIndex,
  (idx) => {
    currentIndex.value = idx;
    resetZoom();
  },
);
</script>

<template>
  <!-- 组件：ImageLightbox｜职责：全屏图片灯箱 -->
  <Teleport to="body">
    <div
      class="cp-lightbox__backdrop"
      @click="onBackdropClick"
      @mousemove="onDrag"
      @mouseup="stopDrag"
      @mouseleave="stopDrag"
    >
      <!-- 顶部栏 -->
      <div class="cp-lightbox__topBar">
        <span class="cp-lightbox__filename">{{
          currentImage?.filename ?? ""
        }}</span>
        <span class="cp-lightbox__counter">{{ counterText }}</span>
        <div class="cp-lightbox__topActions">
          <a
            v-if="currentImage?.url"
            :href="currentImage.url"
            class="cp-lightbox__download"
            target="_blank"
            rel="noopener noreferrer"
            download
          >
            ↓
          </a>
          <button
            class="cp-lightbox__closeBtn"
            type="button"
            aria-label="Close lightbox"
            @click="close"
          >
            ×
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
          ‹
        </button>

        <!-- 图片容器 -->
        <div class="cp-lightbox__imageWrap">
          <img
            v-if="currentImage"
            :src="currentImage.url"
            :alt="currentImage.filename"
            class="cp-lightbox__image"
            :style="{
              transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            }"
            @mousedown="startDrag"
            @wheel.prevent="handleWheel"
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
          ›
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
          @click="currentIndex = idx; resetZoom()"
        >
          <img
            :src="img.url"
            :alt="img.filename"
            class="cp-lightbox__thumbImg"
          />
        </button>
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

.cp-lightbox__download {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  text-decoration: none;
  font-size: 18px;
  transition: background 120ms ease;
}

.cp-lightbox__download:hover {
  background: rgba(255, 255, 255, 0.25);
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
  font-size: 20px;
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

/* 左右箭头 */
.cp-lightbox__arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 40px;
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
</style>
