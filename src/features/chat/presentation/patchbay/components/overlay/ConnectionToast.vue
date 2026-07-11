<script setup lang="ts">
/**
 * @fileoverview 连接状态悬浮窗
 * @description 仅在非 connected 状态时显示于左下角。
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

function handleAction(): void {
  emit("action");
}
</script>

<template>
  <div class="cp-connection-toast" role="status" aria-live="polite" aria-atomic="true" :data-state="props.state">
    <span class="cp-connection-toast__led" aria-hidden="true"></span>
    <div class="cp-connection-toast__text">
      <div class="cp-connection-toast__label">{{ props.label }}</div>
      <div v-if="props.detail" class="cp-connection-toast__detail">{{ props.detail }}</div>
    </div>
    <button
      v-if="props.actionLabel"
      class="cp-connection-toast__action"
      type="button"
      @click="handleAction"
    >
      {{ props.actionLabel }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.cp-connection-toast {
  position: fixed;
  left: 16px;
  /* 抬到底部服务器栏页脚（插件/设置两个按钮）之上，避免遮挡 */
  bottom: calc(12px + 36px + 10px + 36px + 12px + 8px);
  z-index: 80;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  box-shadow: var(--cp-shadow-float);
  color: var(--cp-text);
  max-width: min(420px, 80vw);
}

.cp-connection-toast__led {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--cp-domain-unknown);
  flex: 0 0 auto;
}

.cp-connection-toast[data-state="reconnecting"] .cp-connection-toast__led {
  background: var(--cp-warn);
  animation: cp-led-breathe 1.25s var(--cp-ease) infinite;
}

.cp-connection-toast[data-state="offline"] .cp-connection-toast__led {
  background: var(--cp-danger);
  animation: cp-led-blink 1.4s var(--cp-ease) infinite;
}

.cp-connection-toast__text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cp-connection-toast__label {
  font-size: 13px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-connection-toast__detail {
  font-size: 11px;
  color: var(--cp-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-connection-toast__action {
  margin-left: 6px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color var(--cp-fast) var(--cp-ease);
}

.cp-connection-toast__action:hover {
  background: var(--cp-hover-bg);
}

@keyframes cp-led-blink {
  0%, 70% { opacity: 1; }
  85%, 100% { opacity: 0.35; }
}

@keyframes cp-led-breathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  55% { transform: scale(0.92); opacity: 0.72; }
}

@media (prefers-reduced-motion: reduce) {
  .cp-connection-toast__led {
    animation: none !important;
  }
}
</style>
