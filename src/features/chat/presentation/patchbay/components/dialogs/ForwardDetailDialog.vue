<script setup lang="ts">
/**
 * @fileoverview ForwardDetailDialog.vue
 * @description chat｜组件：转发消息详情弹窗，展示合并转发消息的完整内容。
 */

import { useI18n } from "vue-i18n";

type ForwardedMessageEntry = {
  messageId: string;
  channelId: string;
  userId: string;
  preview: string;
  sentTime: number;
};

const props = defineProps<{
  visible: boolean;
  fromName: string;
  forwardedMessages: ForwardedMessageEntry[];
  comment?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { t } = useI18n();

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function handleClose(): void {
  emit("close");
}
</script>

<template>
  <t-dialog
    :visible="props.visible"
    :header="t('forward_detail_title', { name: props.fromName })"
    :footer="false"
    width="480px"
    @close="handleClose"
  >
    <div class="cp-forwardDetail">
      <div class="cp-forwardDetail__header">
        <span class="cp-forwardDetail__icon">📋</span>
        <span class="cp-forwardDetail__title">
          {{ t("forwarded_messages_count", { name: props.fromName, count: props.forwardedMessages.length }) }}
        </span>
      </div>
      <div v-if="props.comment" class="cp-forwardDetail__comment">
        {{ props.comment }}
      </div>
      <div class="cp-forwardDetail__messages">
        <div
          v-for="(fm, idx) in props.forwardedMessages"
          :key="`fd-${idx}`"
          class="cp-forwardDetail__msg"
        >
          <div class="cp-forwardDetail__msgMeta">
            <span class="cp-forwardDetail__msgAuthor">{{ fm.userId }}</span>
            <span class="cp-forwardDetail__msgTime">{{ fmtTime(fm.sentTime) }}</span>
          </div>
          <div class="cp-forwardDetail__msgPreview">
            {{ fm.preview || "..." }}
          </div>
        </div>
      </div>
      <div class="cp-forwardDetail__actions">
        <button class="cp-forwardDetail__btn" type="button" @click="handleClose">
          {{ t("close") }}
        </button>
      </div>
    </div>
  </t-dialog>
</template>

<style scoped lang="scss">
.cp-forwardDetail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cp-forwardDetail__header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--cp-text-secondary, #a6adc8);
}
.cp-forwardDetail__icon {
  flex-shrink: 0;
}
.cp-forwardDetail__title {
  font-weight: 500;
}
.cp-forwardDetail__comment {
  padding: 10px 12px;
  font-size: 13px;
  color: var(--cp-text, #cdd6f4);
  border-radius: 8px;
  background: color-mix(in oklab, var(--cp-bg, #11111b) 50%, transparent);
  border-left: 3px solid var(--cp-accent, #5865f2);
  line-height: 1.5;
  word-break: break-word;
}
.cp-forwardDetail__messages {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--cp-border, #313244);
  border-radius: 10px;
  overflow: hidden;
  max-height: 360px;
  overflow-y: auto;
}
.cp-forwardDetail__msg {
  padding: 10px 12px;
  border-bottom: 1px solid var(--cp-border-light, rgba(49, 50, 68, 0.2));

  &:last-child { border-bottom: none; }
}
.cp-forwardDetail__msgMeta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.cp-forwardDetail__msgAuthor {
  font-size: 13px;
  font-weight: 600;
  color: var(--cp-text, #cdd6f4);
}
.cp-forwardDetail__msgTime {
  font-size: 11px;
  color: var(--cp-text-muted, #a6adc8);
}
.cp-forwardDetail__msgPreview {
  font-size: 13px;
  color: var(--cp-text-secondary, #a6adc8);
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}
.cp-forwardDetail__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.cp-forwardDetail__btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--cp-border, #313244);
  background: transparent;
  color: var(--cp-text, #cdd6f4);
  font-size: 13px;
  cursor: pointer;

  &:hover {
    background: var(--cp-hover-bg, rgba(255,255,255,0.04));
  }
}
</style>
