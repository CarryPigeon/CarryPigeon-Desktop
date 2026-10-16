<script setup lang="ts">
/**
 * @fileoverview 应用图标组件（AppIcon.vue）。
 * @description 应用图标唯一入口：Lucide 风格 stroke-only SVG，走 currentColor 与 cp-text 主题色，
 * 视觉与文本输入区工具栏图标（ScreenshotButton / FileUploadButton / StickerPickerButton）完全一致。
 * 尺寸默认 `1em`（跟随容器 font-size，与历史 `<t-icon>` 行为一致），需要固定像素时显式传 `:size`。
 */

import { computed } from "vue";
import { ICON_STROKE_WIDTH, LUCIDE_SPRITE } from "./icons/lucide-sprite";

const props = withDefaults(
  defineProps<{
    name: string;
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

const innerHtml = computed<string | null>(() => LUCIDE_SPRITE[props.name] ?? null);

const sizeValue = computed<string>(() => {
  if (typeof props.size === "number") return `${props.size}px`;
  return String(props.size);
});

const hasTitle = computed<boolean>(() => props.title.trim().length > 0);
</script>

<template>
  <!-- 组件：AppIcon｜职责：应用图标（TDesign 缺失时降级到 Lucide 风格 SVG） -->
  <!-- 区块：<svg> .app-icon -->
  <svg
    v-if="innerHtml !== null"
    class="app-icon"
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
    <g v-html="innerHtml" />
  </svg>
  <span v-else class="app-icon app-icon--missing" :title="`AppIcon: ${props.name} missing`">?</span>
</template>

<style scoped lang="scss">
/* 样式：AppIcon */
.app-icon {
  display: inline-block;
  vertical-align: -0.15em;
  flex-shrink: 0;
}

.app-icon--missing {
  display: inline-block;
  width: 1em;
  text-align: center;
  font-size: 12px;
  color: var(--cp-danger);
}
</style>
