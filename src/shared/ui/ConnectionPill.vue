<script setup lang="ts">
/**
 * @fileoverview 连接状态胶囊组件（ConnectionPill.vue）。
 * @description Patchbay 连接状态展示（LED + 文案 + 可选动作）。
 */

export type ConnectionState = "connected" | "reconnecting" | "offline";

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
</script>

<template>
  <!-- 组件：ConnectionPill｜职责：连接状态（LED + 文案 + 可选按钮） -->
  <!-- 区块：<div> .cp-connection-pill -->
  <div class="cp-connection-pill" :data-state="props.state">
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
/* 样式：ConnectionPill */
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
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.12);
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
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
  animation: cp-led-breathe 1.25s var(--cp-ease) infinite;
}

/* 选择器：`.cp-connection-pill[data-state="offline"] .cp-led`｜用途：离线 LED（红色 + 闪烁） */
.cp-connection-pill[data-state="offline"] .cp-led {
  background: var(--cp-danger);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18);
  animation: cp-led-blink 1.4s var(--cp-ease) infinite;
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
  margin-left: 6px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);

  /* 选择器：`.cp-connection-action:hover`｜用途：悬停上浮 + 高亮边框 */
  &:hover {
    transform: translateY(-1px);
    background: var(--cp-hover-bg);
    border-color: color-mix(in oklab, var(--cp-info) 30%, var(--cp-border));
  }

  &:focus-visible {
    outline: 2px solid color-mix(in oklab, var(--cp-info) 42%, var(--cp-border));
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
