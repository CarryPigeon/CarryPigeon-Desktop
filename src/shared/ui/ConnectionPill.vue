<script setup lang="ts">
/**
 * @fileoverview ConnectionPill.vue
 * @description Patchbay connection status pill (LED + label + optional action).
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
 * handleAction 方法说明。
 * @returns 返回值说明。
 */
function handleAction() {
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

.cp-led {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--cp-domain-unknown);
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.12);
  flex: 0 0 auto;
}

.cp-connection-pill[data-state="connected"] .cp-led {
  background: var(--cp-accent);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
}

.cp-connection-pill[data-state="reconnecting"] .cp-led {
  background: var(--cp-warn);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
  animation: cp-led-breathe 1.25s var(--cp-ease) infinite;
}

.cp-connection-pill[data-state="offline"] .cp-led {
  background: var(--cp-danger);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18);
  animation: cp-led-blink 1.4s var(--cp-ease) infinite;
}

.cp-connection-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cp-connection-label {
  font-size: 12px;
  line-height: 1.2;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-connection-detail {
  font-size: 11px;
  line-height: 1.2;
  color: var(--cp-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

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

  &:hover {
    transform: translateY(-1px);
    background: var(--cp-hover-bg);
    border-color: rgba(56, 189, 248, 0.30);
  }
}

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
</style>

