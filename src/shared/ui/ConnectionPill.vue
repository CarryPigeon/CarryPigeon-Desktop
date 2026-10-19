<script setup lang="ts">
/**
 * @fileoverview 连接状态胶囊组件（ConnectionPill.vue）。
 * @description Patchbay 连接状态展示（LED + 文案 + 可选动作）。
 */

import { computed } from "vue";

export type ConnectionState = "connected" | "reconnecting" | "offline" | "idle";

const props = withDefaults(
  defineProps<{
    state: ConnectionState;
    label: string;
    detail?: string;
    actionLabel?: string;
  }>(),
  {
    detail: "",
    actionLabel: "",
  },
);

const emit = defineEmits<{
  (e: "action"): void;
}>();

/**
 * 触发可选动作按钮的 `action` 事件。
 *
 * @returns 无返回值。
 */
function handleAction(): void {
  emit("action");
}

/**
 * 派生显示状态：首屏未尝试连接（offline 且无详情）时呈现中性 idle，避免红色闪烁误导用户。
 *
 * @returns 实际渲染用的状态。
 */
const displayState = computed<ConnectionState>(() =>
  props.state === "offline" && !props.detail ? "idle" : props.state,
);
</script>

<template>
  <!-- 组件：ConnectionPill｜职责：连接状态（LED + 文案 + 可选按钮） -->
  <!-- 区块：<div> .cp-connection-pill -->
  <div class="cp-connection-pill" :data-state="displayState">
    <span class="cp-led" aria-hidden="true"></span>
    <div class="cp-connection-text">
      <div class="cp-connection-label">{{ props.label }}</div>
      <div v-if="props.detail" class="cp-connection-detail">{{ props.detail }}</div>
    </div>
    <button
      v-if="props.actionLabel"
      class="cp-connection-action"
      type="button"
      @click="handleAction"
    >
      {{ props.actionLabel }}
    </button>
  </div>
</template>

<style scoped lang="scss">
/* 样式：ConnectionPill｜规格：状态胶囊（LED 保留状态色，hover 只变色不移位） */
/* 选择器：`.cp-connection-pill`｜用途：状态胶囊容器（LED + 文案 + 可选动作） */
.cp-connection-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  box-shadow: var(--cp-shadow-soft);
  color: var(--cp-text);
  max-width: min(520px, 56vw);
}

/* 选择器：`.cp-led`｜用途：默认 LED 点（未知态颜色） */
.cp-led {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--cp-domain-unknown);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cp-domain-unknown) 18%, transparent);
  flex: 0 0 auto;
}

/* 选择器：`.cp-connection-pill[data-state="connected"] .cp-led`｜用途：已连接 LED（稳定绿） */
.cp-connection-pill[data-state="connected"] .cp-led {
  background: var(--cp-accent);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cp-accent) 18%, transparent);
}

/* 选择器：`.cp-connection-pill[data-state="reconnecting"] .cp-led`｜用途：重连中 LED（琥珀色 + 呼吸） */
.cp-connection-pill[data-state="reconnecting"] .cp-led {
  background: var(--cp-warn);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cp-warn) 18%, transparent);
  animation: cp-led-breathe 1.25s var(--cp-ease) infinite;
}

/* 选择器：`.cp-connection-pill[data-state="offline"] .cp-led`｜用途：离线 LED（红色 + 闪烁） */
.cp-connection-pill[data-state="offline"] .cp-led {
  background: var(--cp-danger);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cp-danger) 18%, transparent);
  animation: cp-led-blink 1.4s var(--cp-ease) infinite;
}

/* 选择器：`.cp-connection-pill[data-state="idle"] .cp-led`｜用途：未尝试连接（中性灰，无动画） */
.cp-connection-pill[data-state="idle"] .cp-led {
  background: var(--cp-domain-unknown);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cp-domain-unknown) 18%, transparent);
}

/* 选择器：`.cp-connection-text`｜用途：文案容器（label/detail 垂直堆叠 + 截断） */
.cp-connection-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 选择器：`.cp-connection-label`｜用途：主文案（单行） */
.cp-connection-label {
  font-size: 12px;
  line-height: 1.2;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 选择器：`.cp-connection-detail`｜用途：副文案（单行） */
.cp-connection-detail {
  font-size: 11px;
  line-height: 1.2;
  color: var(--cp-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 选择器：`.cp-connection-action`｜用途：可选动作按钮（例如 Retry） */
.cp-connection-action {
  @include cp-pill-button(primary);

  min-height: 24px;
  padding: 0 10px;
  margin-left: 6px;
  font-size: 11.5px;
  flex: 0 0 auto;

  &:focus-visible {
    outline: 2px solid var(--cp-highlight-border-strong);
    outline-offset: 2px;
  }
}

/* 动画：`cp-led-blink`｜用途：离线 LED 闪烁循环 */
@keyframes cp-led-blink {
  0%,
  70% {
    opacity: 1;
  }
  85%,
  100% {
    opacity: 0.35;
  }
}

/* 动画：`cp-led-breathe`｜用途：重连中 LED 轻微“呼吸”循环 */
@keyframes cp-led-breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  55% {
    transform: scale(0.92);
    opacity: 0.72;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cp-led {
    animation: none !important;
  }

  .cp-connection-action {
    transition: none !important;
  }
}
</style>
