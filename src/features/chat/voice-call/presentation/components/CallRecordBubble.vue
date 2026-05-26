<template>
  <div class="call-record-bubble">
    <div class="call-record-bubble__header">
      <t-icon name="call" class="call-record-bubble__icon" />
      <span class="call-record-bubble__title">语音通话</span>
    </div>
    <div class="call-record-bubble__body">
      <div class="call-record-bubble__row">
        <span class="call-record-bubble__label">发起人</span>
        <span class="call-record-bubble__value">{{ initiatorName }}</span>
      </div>
      <div v-if="summary.duration > 0" class="call-record-bubble__row">
        <span class="call-record-bubble__label">时长</span>
        <span class="call-record-bubble__value">{{ formattedDuration }}</span>
      </div>
      <div class="call-record-bubble__row">
        <span class="call-record-bubble__label">状态</span>
        <span class="call-record-bubble__value call-record-bubble__value--status">{{ statusText }}</span>
      </div>
    </div>
    <div class="call-record-bubble__footer">
      <button class="call-record-bubble__btn" @click="$emit('callback')">
        <t-icon name="call" /> 回拨
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CallSummary } from "../../domain/contracts";

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
  if (min > 0) return `${min} 分 ${sec} 秒`;
  return `${sec} 秒`;
});

const statusText = computed(() => {
  if (props.summary.disconnectReason === "timeout") return "未接听";
  if (props.summary.disconnectReason === "declined") return "已拒绝";
  if (props.summary.disconnectReason === "cancelled") return "已取消";
  return "已结束";
});
</script>

<style scoped lang="scss">
.call-record-bubble {
  max-width: 240px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  background: var(--td-bg-color-container);
  padding: 12px;
  font-size: 13px;

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    font-weight: 500;
    color: var(--td-text-color-primary);
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
    color: var(--td-text-color-secondary);
  }

  &__value {
    color: var(--td-text-color-primary);

    &--status {
      color: var(--td-text-color-placeholder);
    }
  }

  &__footer {
    text-align: right;
  }

  &__btn {
    padding: 4px 12px;
    border: 1px solid var(--td-brand-color);
    border-radius: 4px;
    background: transparent;
    color: var(--td-brand-color);
    font-size: 12px;
    cursor: pointer;

    &:hover {
      background: var(--td-brand-color-light);
    }
  }
}
</style>
