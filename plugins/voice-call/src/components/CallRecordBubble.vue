<template>
  <div class="call-record-bubble">
    <div class="call-record-bubble__header">
      <t-icon name="call" class="call-record-bubble__icon" />
      <span class="call-record-bubble__title">{{ t("voice_call") }}</span>
    </div>
    <div class="call-record-bubble__body">
      <div class="call-record-bubble__row">
        <span class="call-record-bubble__label">{{ t("voice_call_initiator") }}</span>
        <span class="call-record-bubble__value">{{ initiatorName }}</span>
      </div>
      <div v-if="summary.duration > 0" class="call-record-bubble__row">
        <span class="call-record-bubble__label">{{ t("voice_call_duration") }}</span>
        <span class="call-record-bubble__value">{{ formattedDuration }}</span>
      </div>
      <div class="call-record-bubble__row">
        <span class="call-record-bubble__label">{{ t("voice_call_status") }}</span>
        <span class="call-record-bubble__value call-record-bubble__value--status">{{ statusText }}</span>
      </div>
    </div>
    <div class="call-record-bubble__footer">
      <button class="call-record-bubble__btn" @click="$emit('callback')">
        <t-icon name="call" /> {{ t("voice_call_callback") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CallKind, CallSummary } from "../domain/contracts";
import { t } from "../i18n";

/**
 * 通用插件消息渲染契约（由宿主 MessageContentHost 的 plugin 分支传入）。
 * 仅消费 `data` / `from`，其余字段保留以兼容未来扩展。
 */
const props = defineProps<{
  data?: unknown;
  context?: unknown;
  preview?: unknown;
  domain?: string;
  domainVersion?: string;
  mid?: string;
  from?: { id: string; name: string };
  timeMs?: number;
  replyToMid?: string;
}>();

defineEmits<{
  callback: [];
}>();

/** 从消息 data 提取通话摘要，缺失字段以安全默认值兜底。 */
const summary = computed<CallSummary>(() => {
  const d = (props.data ?? {}) as Partial<CallSummary> & Record<string, unknown>;
  return {
    sessionId: String(d.sessionId ?? ""),
    kind: (d.kind as CallKind) ?? "direct",
    duration: Number(d.duration ?? 0),
    disconnectReason: String(d.disconnectReason ?? ""),
  };
});

/** 发起方名称：优先取 data.initiatorName，其次回落到消息发送者。 */
const initiatorName = computed<string>(() => {
  const d = (props.data ?? {}) as Record<string, unknown>;
  return String(d.initiatorName ?? props.from?.name ?? "");
});

const formattedDuration = computed(() => {
  if (summary.value.duration <= 0) return "";
  const totalSec = Math.floor(summary.value.duration / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return t("voice_call_duration_format", { min, sec });
  return t("voice_call_duration_seconds", { sec });
});

const statusText = computed(() => {
  if (summary.value.disconnectReason === "timeout") return t("voice_call_status_missed");
  if (summary.value.disconnectReason === "declined") return t("voice_call_status_declined");
  if (summary.value.disconnectReason === "cancelled") return t("voice_call_status_cancelled");
  return t("voice_call_status_ended");
});
</script>

<style scoped lang="scss">
.call-record-bubble {
  max-width: 240px;
  border: 1px solid var(--cp-border);
  border-radius: 8px;
  background: var(--cp-surface);
  padding: 12px;
  font-size: 13px;

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    font-weight: 500;
    color: var(--cp-text);
  }

  &__body {
    margin-bottom: 8px;
  }

  &__row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  &__label {
    color: var(--cp-text-muted);
  }

  &__value {
    color: var(--cp-text);

    &--status {
      color: var(--cp-text-light);
    }
  }

  &__footer {
    text-align: right;
  }

  &__btn {
    padding: 4px 12px;
    border: 1px solid var(--cp-accent);
    border-radius: 4px;
    background: transparent;
    color: var(--cp-accent);
    font-size: 12px;
    cursor: pointer;

    &:hover {
      background: var(--cp-accent-soft);
    }
  }
}
</style>
