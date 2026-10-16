<script setup lang="ts">
/**
 * @fileoverview 应用品牌标记（AppLogo.vue）。
 * @description 自绘 stroke-only 信鸽标记（信封 + 鸽翼），与 `AppIcon` 共用同一契约
 * （24×24 viewBox、fill none、currentColor、ICON_STROKE_WIDTH、round），
 * 保证任何尺寸下与应用图标（尤其是文本输入区图标）完全同风格。
 */

import { computed } from "vue";
import { ICON_STROKE_WIDTH } from "./icons/lucide-sprite";

const props = withDefaults(
  defineProps<{
    size?: number | string;
    strokeWidth?: number;
    title?: string;
  }>(),
  {
    size: "1em",
    strokeWidth: ICON_STROKE_WIDTH,
    title: "",
  },
);

const sizeValue = computed<string>(() => {
  if (typeof props.size === "number") return `${props.size}px`;
  return String(props.size);
});

const hasTitle = computed<boolean>(() => props.title.trim().length > 0);
</script>

<template>
  <!-- 组件：AppLogo｜职责：自绘品牌标记（信封 + 鸽翼），与图标同一 stroke 契约 -->
  <!-- 区块：<svg> .app-logo -->
  <svg
    class="app-logo"
    :width="sizeValue"
    :height="sizeValue"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="props.strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="hasTitle ? undefined : 'true'"
    :role="hasTitle ? 'img' : undefined"
  >
    <title v-if="hasTitle">{{ props.title }}</title>
    <!-- 鸽翼：自左下向右上收拢的弧线 -->
    <path d="M8.5 5.6c2.6 2.1 5.8 2.6 9.6 1.6" />
    <!-- 信封主体与封口 -->
    <path d="M3.5 9h17v10.5h-17z" />
    <path d="m3.5 10 8.5 5.8 8.5-5.8" />
  </svg>
</template>

<style scoped>
/* 样式：AppLogo */
.app-logo {
  display: inline-block;
  vertical-align: -0.15em;
  flex-shrink: 0;
}
</style>
