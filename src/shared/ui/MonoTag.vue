<script setup lang="ts">
/**
 * @fileoverview 单行等宽铭牌（MonoTag.vue）。
 * @description 用于 socket/id 等显示的等宽铭牌，支持可选复制。
 */

import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    value: string;
    title?: string;
    copyable?: boolean;
  }>(),
  {
    title: "",
    copyable: false,
  },
);

/**
 * 计算铭牌显示值。
 *
 * @returns 裁剪后的铭牌值。
 */
function computeDisplay(): string {
  return props.value.trim();
}

const display = computed(computeDisplay);

/**
 * 复制铭牌值到剪贴板（best-effort）。
 *
 * 设计说明：该组件不主动弹 toast，以保持通用性（由上层决定提示方式）。
 *
 * @returns Promise<void>
 */
async function handleCopy(): Promise<void> {
  if (!props.copyable) return;
  const text = display.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // 尽力而为复制：忽略失败（权限/环境限制等）。
  }
}
</script>

<template>
  <!-- 组件：MonoTag｜职责：mono 铭牌（可选复制） -->
  <!-- 区块：<button> -->
  <button
    class="mono-tag"
    :class="{ copyable: props.copyable }"
    type="button"
    :title="props.title || display"
    @click="handleCopy"
  >
    <span class="mono-tag__text">{{ display || "—" }}</span>
    <span v-if="props.copyable" class="mono-tag__hint" aria-hidden="true">⧉</span>
  </button>
</template>

<style scoped lang="scss">
/* 样式：MonoTag */
/* 选择器：`.mono-tag`｜用途：socket/id 等等宽铭牌 */
.mono-tag {
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: default;
}

/* 选择器：`.mono-tag.copyable`｜用途：可交互变体（启用 hover 提示） */
.mono-tag.copyable {
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);

  /* 选择器：`.mono-tag.copyable:hover`｜用途：轻微上浮 + info 边框高亮 */
  &:hover {
    transform: translateY(-1px);
    background: var(--cp-hover-bg);
    border-color: color-mix(in oklab, var(--cp-info) 30%, var(--cp-border));
  }
}

/* 选择器：`.mono-tag__text`｜用途：等宽文本内容（截断） */
.mono-tag__text {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

/* 选择器：`.mono-tag__hint`｜用途：复制提示符（非关键） */
.mono-tag__hint {
  opacity: 0.65;
  font-family: var(--cp-font-mono);
  font-size: 12px;
}
</style>
