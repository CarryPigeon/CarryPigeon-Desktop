<script setup lang="ts">
/**
 * @fileoverview MergedForwardBubble.vue
 * @description chat｜组件：合并转发消息卡片，展示被合并转发的多条消息。
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
  messageId: string;
  fromName: string;
  forwardedMessages: ForwardedMessageEntry[];
  comment?: string;
}>();

const emit = defineEmits<{
  (e: "viewDetail"): void;
}>();

const { t } = useI18n();

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
</script>

<template>
  <div class="cp-mergedForward" role="button" tabindex="0" @click="emit('viewDetail')" @keydown.enter="emit('viewDetail')" @keydown.space.prevent="emit('viewDetail')">
    <div class="cp-mergedForward__header">
      <span class="cp-mergedForward__icon">📋</span>
      <span class="cp-mergedForward__title">
        {{ t("forwarded_messages_count", { name: props.fromName, count: props.forwardedMessages.length }) }}
      </span>
    </div>
    <div v-if="props.comment" class="cp-mergedForward__comment">
      {{ props.comment }}
    </div>
    <div class="cp-mergedForward__messages">
      <div
        v-for="(fm, idx) in props.forwardedMessages"
        :key="`${props.messageId}-${idx}`"
        class="cp-mergedForward__msg"
      >
        <div class="cp-mergedForward__msgMeta">
          <span class="cp-mergedForward__msgAuthor">{{ fm.userId }}</span>
          <span class="cp-mergedForward__msgTime">{{ fmtTime(fm.sentTime) }}</span>
        </div>
        <div class="cp-mergedForward__msgPreview">
          {{ fm.preview || "..." }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cp-mergedForward {
  border: 1px solid var(--cp-border, #313244);
  border-radius: 12px;
  background: color-mix(in oklab, var(--cp-panel, #1e1e2e) 70%, transparent);
  overflow: hidden;
  max-width: 380px;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;

  &:hover {
    border-color: var(--cp-accent, #5865f2);
    box-shadow: 0 0 0 1px color-mix(in oklab, var(--cp-accent, #5865f2) 30%, transparent);
  }
}
.cp-mergedForward__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--cp-border-light, rgba(49, 50, 68, 0.4));
  font-size: 13px;
  color: var(--cp-text-secondary, #a6adc8);
  background: color-mix(in oklab, var(--cp-primary) 6%, transparent);
}
.cp-mergedForward__icon {
  flex-shrink: 0;
  font-size: 14px;
}
.cp-mergedForward__title {
  font-weight: 500;
}
.cp-mergedForward__comment {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--cp-text, #cdd6f4);
  border-bottom: 1px solid var(--cp-border-light, rgba(49, 50, 68, 0.4));
  background: color-mix(in oklab, var(--cp-bg, #11111b) 50%, transparent);
}
.cp-mergedForward__messages {
  display: flex;
  flex-direction: column;
}
.cp-mergedForward__msg {
  padding: 8px 12px;
  border-bottom: 1px solid var(--cp-border-light, rgba(49, 50, 68, 0.2));

  &:last-child { border-bottom: none; }
}
.cp-mergedForward__msgMeta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}
.cp-mergedForward__msgAuthor {
  font-size: 12px;
  font-weight: 600;
  color: var(--cp-text, #cdd6f4);
}
.cp-mergedForward__msgTime {
  font-size: 10px;
  color: var(--cp-text-muted, #a6adc8);
}
.cp-mergedForward__msgPreview {
  font-size: 12px;
  color: var(--cp-text-secondary, #a6adc8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
