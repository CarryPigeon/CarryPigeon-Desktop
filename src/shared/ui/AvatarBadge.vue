<script setup lang="ts">
/**
 * @fileoverview 头像徽章组件（AvatarBadge.vue）。
 * @description 最小头像徽章（首字母 + 确定性颜色），用于消息/频道/成员等 UI。
 *
 * 设计意图（方案A｜Patchbay）：
 * - 头像仅作为“定位线索”，而非主要视觉信号。
 * - 2px 的 domain 信号色条仍是第一视觉线索；头像需要更克制。
 */

import { computed } from "vue";
import type { CSSProperties } from "vue";

const props = withDefaults(
  defineProps<{
    name: string;
    size?: number;
  }>(),
  {
    size: 30,
  },
);

/**
 * 将字符串确定性映射为 hue（0..359）。
 *
 * 用途：无需额外存储，即可让头像颜色在跨会话场景保持稳定。
 *
 * @param input - 输入字符串（例如用户名）。
 * @returns hue 值。
 */
function hashToHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * 将请求的头像尺寸限制在稳定范围内。
 *
 * 目的：防止调用方传入极端尺寸导致布局破坏。
 *
 * @param size - 请求尺寸（px）。
 * @returns 限制后的尺寸（px）。
 */
function clampAvatarSize(size: number | undefined): number {
  const raw = Math.trunc(size ?? 30);
  return Math.max(22, Math.min(44, raw));
}

/**
 * 将显示名转换为 1–2 个字符的头像标签。
 *
 * 规则：
 * - 空名称显示为中性短横线。
 * - 多段名称取首段 + 末段首字母。
 * - 单段名称取首字符。
 *
 * @param name - 显示名。
 * @returns 大写短标签（最多 2 字符）。
 */
function computeInitial(name: string): string {
  const raw = name.trim();
  if (!raw) return "—";
  const parts = raw.split(/\s+/g);
  const first = parts[0]?.[0] ?? raw[0] ?? "—";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + second).toUpperCase().slice(0, 2);
}

/**
 * 计算当前 props 对应的头像标签。
 *
 * @returns 首字母标签。
 */
function computeInitialForProps(): string {
  return computeInitial(props.name);
}

const initial = computed(computeInitialForProps);

/**
 * 计算当前 props 对应的 hue。
 *
 * @returns hue（0..359）。
 */
function computeHueForProps(): number {
  return hashToHue(props.name.trim().toLowerCase());
}

const hue = computed(computeHueForProps);

/**
 * 构造头像 CSS 使用的行内样式变量。
 *
 * @returns 包含 `width/height` 与 CSS 变量的 Vue 样式对象。
 */
function computeStyleVarsForProps(): CSSProperties {
  const size = clampAvatarSize(props.size);
  return {
    width: `${size}px`,
    height: `${size}px`,
    "--cp-avatar-size": `${size}px`,
    "--cp-avatar-hue": String(hue.value),
  } as CSSProperties;
}

const styleVars = computed(computeStyleVarsForProps);
</script>

<template>
  <!-- 组件：AvatarBadge｜职责：头像（无图片时用首字母） -->
  <!-- 区块：<span> .cp-avatar -->
  <span class="cp-avatar" :style="styleVars" :title="props.name" aria-hidden="true">
    <span class="cp-avatar__inner">{{ initial }}</span>
  </span>
</template>

<style scoped lang="scss">
/* 样式：AvatarBadge */
/* 选择器：`.cp-avatar`｜用途：外层头像圆（克制的表面 + 轻微 hue 身份） */
.cp-avatar {
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  border: 1px solid var(--cp-border);
  background:
    radial-gradient(12px 12px at 30% 30%, color-mix(in oklab, var(--cp-info) 22%, transparent), transparent 60%),
    radial-gradient(14px 14px at 70% 70%, color-mix(in oklab, var(--cp-accent) 16%, transparent), transparent 60%),
    linear-gradient(
      180deg,
      color-mix(in oklab, hsl(var(--cp-avatar-hue) 60% 55%) 16%, var(--cp-panel)),
      color-mix(in oklab, hsl(calc(var(--cp-avatar-hue) + 40) 70% 50%) 12%, var(--cp-panel-muted))
    );
  box-shadow: 0 10px 18px rgba(20, 32, 29, 0.10);
  user-select: none;
  flex: 0 0 auto;
}

/* 选择器：`.cp-avatar__inner`｜用途：首字母文本（在 28–32px 时仍可读） */
.cp-avatar__inner {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.06em;
  font-size: clamp(10px, calc(var(--cp-avatar-size) / 2.65), 12px);
  color: color-mix(in oklab, var(--cp-text) 86%, transparent);
  text-transform: uppercase;
}
</style>
