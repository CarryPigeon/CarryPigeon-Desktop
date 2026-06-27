<script setup lang="ts">
/**
 * @fileoverview 应用图标组件（AppIcon.vue）。
 * @description Lucide 风格的 stroke-only SVG 图标，作为 TDesign `<t-icon>` 缺失时的补充；
 * 走 currentColor 与 cp-text 主题色，视觉与 ScreenshotButton 等内联 SVG 一致。
 */

import { computed } from "vue";
import { LUCIDE_SPRITE } from "./icons/lucide-sprite";

const props = withDefaults(
  defineProps<{
    name: string;
    size?: number | string;
    strokeWidth?: number;
    title?: string;
  }>(),
  {
    size: 16,
    strokeWidth: 1.75,
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
