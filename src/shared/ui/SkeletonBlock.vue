<script setup lang="ts">
/**
 * @fileoverview SkeletonBlock.vue
 * @description 骨架屏占位块 — 用于加载态的占位渲染，支持多种变体。
 */

withDefaults(
  defineProps<{
    /** 变体类型 */
    variant?: "text" | "title" | "avatar" | "card" | "line";
    /** 宽度（CSS 值），默认 auto */
    width?: string;
    /** 高度（CSS 值），默认 auto */
    height?: string;
  }>(),
  {
    variant: "text",
    width: undefined,
    height: undefined,
  },
);
</script>

<template>
  <!-- 组件：SkeletonBlock｜职责：加载态占位块（pulse 动画） -->
  <span
    class="cp-skeleton"
    :class="`cp-skeleton--${variant}`"
    :style="{
      width: width || undefined,
      height: height || undefined,
    }"
    aria-hidden="true"
  />
</template>

<style scoped lang="scss">
/* 骨架屏脉冲动画 */
.cp-skeleton {
  display: block;
  background: var(--cp-hover-bg, rgba(148, 163, 184, 0.12));
  border-radius: 6px;
  animation: cp-skeleton-pulse 1.6s var(--cp-ease, ease-in-out) infinite;
}

.cp-skeleton--text {
  height: 12px;
  width: 100%;
  border-radius: 6px;
}

.cp-skeleton--title {
  height: 16px;
  width: 60%;
  border-radius: 8px;
}

.cp-skeleton--avatar {
  width: 32px;
  height: 32px;
  border-radius: 999px;
}

.cp-skeleton--card {
  height: 120px;
  width: 100%;
  border-radius: 12px;
}

.cp-skeleton--line {
  height: 1px;
  width: 100%;
  border-radius: 0;
}

@keyframes cp-skeleton-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.8;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cp-skeleton {
    animation: none;
    opacity: 0.5;
  }
}
</style>
