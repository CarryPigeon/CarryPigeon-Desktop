<script setup lang="ts">
/**
 * @fileoverview MergedForwardBubble.vue
 * @description chat｜组件：合并转发消息卡片，展示被合并转发的多条消息。
 */

import { useI18n } from "vue-i18n";
import type { ForwardedMessageEntry } from "@/features/chat/message-flow/message/domain/messageModels";
import AppIcon from "@/shared/ui/AppIcon.vue";

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
      <span class="cp-mergedForward__icon"><AppIcon name="clipboard" /></span>
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
          <span class="cp-mergedForward__msgAuthor">{{ fm.authorName || fm.userId }}</span>
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
/* 样式：MergedForwardBubble｜规格：内嵌卡片（卡片圆角 + 行分隔），hover 只变描边/底色 */
.cp-mergedForward {
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius-card);
  background: var(--cp-panel);
  overflow: hidden;
  max-width: 380px;
  cursor: pointer;
  transition:
    border-color var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease);

  &:hover {
    border-color: var(--cp-highlight-border);
    background: var(--cp-highlight-bg);
  }
}
.cp-mergedForward__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--cp-border-light);
  font-size: 13px;
  color: var(--cp-text-muted);
  background: var(--cp-panel-muted);
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
  color: var(--cp-text);
  border-bottom: 1px solid var(--cp-border-light);
  background: var(--cp-panel-muted);
}
.cp-mergedForward__messages {
  display: flex;
  flex-direction: column;
}
.cp-mergedForward__msg {
  padding: 8px 12px;
  border-top: 1px solid var(--cp-border-light);

  &:first-child { border-top: none; }
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
  color: var(--cp-text);
}
.cp-mergedForward__msgTime {
  font-size: 10px;
  color: var(--cp-text-muted);
}
.cp-mergedForward__msgPreview {
  font-size: 12px;
  color: var(--cp-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
