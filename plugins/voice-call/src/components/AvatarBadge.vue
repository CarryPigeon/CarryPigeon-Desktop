<script setup lang="ts">
/**
 * @fileoverview 头像徽章组件（AvatarBadge.vue，插件本地副本）。
 * @description 统一头像组件：有图片时显示图片，无图片时显示首字母 + 确定性颜色。
 *              仅依赖 vue，无宿主运行期依赖，保证插件自包含。
 */

import { computed } from "vue";
import type { CSSProperties } from "vue";

const props = withDefaults(
  defineProps<{
    /** 用户显示名（用于生成首字母 fallback 与 alt 文本）。 */
    name: string;
    /** 头像图片 URL（可选）。提供时展示图片，否则展示首字母徽章。 */
    avatarUrl?: string;
    /** 头像尺寸（px），会被钳制在 22–96 之间。 */
    size?: number;
  }>(),
  {
    avatarUrl: "",
    size: 30,
  },
);

const hasAvatarImage = computed(() => (props.avatarUrl ?? "").trim().length > 0);

function hashToHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

function clampAvatarSize(size: number | undefined): number {
  const raw = Math.trunc(size ?? 30);
  return Math.max(22, Math.min(96, raw));
}

function computeInitial(name: string): string {
  const raw = name.trim();
  if (!raw) return "—";
  const parts = raw.split(/\s+/g);
  const first = parts[0]?.[0] ?? raw[0] ?? "—";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + second).toUpperCase().slice(0, 2);
}

const initial = computed(() => computeInitial(props.name));

function computeHue(): number {
  return hashToHue(props.name.trim().toLowerCase());
}

const hue = computed(computeHue);

function computeStyleVars(): CSSProperties {
  const size = clampAvatarSize(props.size);
  return {
    width: `${size}px`,
    height: `${size}px`,
    "--cp-avatar-size": `${size}px`,
    "--cp-avatar-hue": String(hue.value),
  } as CSSProperties;
}

const styleVars = computed(computeStyleVars);
</script>

<template>
  <span class="cp-avatar" :class="{ 'cp-avatar--image': hasAvatarImage }" :style="styleVars" :title="props.name" aria-hidden="true">
    <img v-if="hasAvatarImage" class="cp-avatar__img" :src="props.avatarUrl" :alt="props.name" />
    <span v-else class="cp-avatar__inner">{{ initial }}</span>
  </span>
</template>

<style scoped lang="scss">
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
  overflow: hidden;
}

.cp-avatar--image {
  background: var(--cp-panel);
}

.cp-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 999px;
}

.cp-avatar__inner {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.06em;
  font-size: clamp(10px, calc(var(--cp-avatar-size) / 2.65), 12px);
  color: color-mix(in oklab, var(--cp-text) 86%, transparent);
  text-transform: uppercase;
}
</style>
