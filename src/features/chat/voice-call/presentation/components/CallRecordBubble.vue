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
import { useI18n } from "vue-i18n";
import type { CallSummary } from "../../domain/contracts";

const { t } = useI18n();

const props = defineProps<{
  summary: CallSummary;
  initiatorName: string;
}>();

defineEmits<{
  callback: [];
}>();

const formattedDuration = computed(() => {
  if (props.summary.duration <= 0) return "";
  const totalSec = Math.floor(props.summary.duration / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return t("voice_call_duration_format", { min, sec });
  return t("voice_call_duration_seconds", { sec });
});

const statusText = computed(() => {
  if (props.summary.disconnectReason === "timeout") return t("voice_call_status_missed");
  if (props.summary.disconnectReason === "declined") return t("voice_call_status_declined");
  if (props.summary.disconnectReason === "cancelled") return t("voice_call_status_cancelled");
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
