<script setup lang="ts">
/**
 * @fileoverview CoreTextMessageBubble.vue
 * @description
 * message-flow/message｜Core:Text 消息气泡（支持 `[file:share_key]` token 分段渲染）。
 */

import FileRefMessageBubble from "./FileRefMessageBubble.vue";
import { hasFileToken, parseCoreTextParts } from "@/features/chat/message-flow/message/domain/coreTextFileSyntax";
import type { MessageMention, MessageReplySummary } from "@/features/chat/message-flow/api-types";

const props = defineProps<{
  /**
   * 消息 id（用于分段 key）。
   */
  messageId: string;
  /**
   * core-text 原始文本。
   */
  text: string;
  /**
   * 回复预览文本（为空表示不展示）。
   */
  replyText?: string;
  /**
   * 回复引用摘要（含发送者、预览等）。
   */
  reply?: MessageReplySummary;
  /**
   * 消息提及列表。
   */
  mentions?: MessageMention[];
  /**
   * 内联引用回复（quote）。
   */
  quoteReply?: {
    messageId: string;
    userId: string;
    preview: string;
  };
  forwardedFrom?: {
    messageId: string;
    channelId: string;
    userId: string;
    preview: string;
    sentTime: number;
  };
}>();

/**
 * 根据提及类型返回对应的 CSS class 名。
 */
function mentionClass(mention: MessageMention): string {
  if (mention.type === "everyone") return "cp-mention--everyone";
  if (mention.type === "here") return "cp-mention--here";
  return "cp-mention--user";
}
</script>

<template>
  <!-- 组件：CoreTextMessageBubble｜职责：渲染 core-text（文本 + 文件引用 token） -->
  <div class="cp-bubble">
    <div v-if="props.forwardedFrom" class="cp-forwardedFrom">
      <span class="cp-forwardedFrom__icon">↩</span>
      <span class="cp-forwardedFrom__text">{{ $t('forwarded_from') }} #{{ props.forwardedFrom.channelId }}</span>
    </div>
    <div v-if="props.quoteReply" class="cp-quoteReply">
      <div class="cp-quoteReply__bar"></div>
      <div class="cp-quoteReply__content">
        <span class="cp-quoteReply__sender">{{ props.quoteReply.userId }}</span>
        <span class="cp-quoteReply__preview">{{ props.quoteReply.preview }}</span>
      </div>
    </div>
    <div v-if="props.reply" class="cp-coreText__reply" :data-unavailable="Boolean(props.reply.unavailable)">
      <div class="cp-coreText__replyAuthor">{{ props.reply.senderName }}</div>
      <div class="cp-coreText__replyPreview">{{ props.reply.unavailable ? 'Original message unavailable' : props.reply.preview }}</div>
    </div>
    <div v-else-if="props.replyText" class="cp-replyMini">
      <div class="cp-replyMini__k">reply</div>
      <div class="cp-replyMini__v">{{ props.replyText }}</div>
    </div>

    <template v-if="hasFileToken(props.text)">
      <template v-for="(p, idx) in parseCoreTextParts(props.text)" :key="`${props.messageId}-${idx}`">
        <span v-if="p.kind === 'text'">{{ p.text }}</span>
        <FileRefMessageBubble v-else :filename="p.shareKey" :share-key="p.shareKey" />
      </template>
    </template>
    <template v-else>{{ props.text }}</template>

    <div v-if="props.mentions?.length" class="cp-mentionList">
      <span
        v-for="m in props.mentions"
        :key="m.userId"
        class="cp-mentionTag"
        :class="mentionClass(m)"
      >
        @{{ m.displayName }}
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cp-quoteReply {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  padding: 4px 0;
}
.cp-quoteReply__bar {
  width: 3px;
  border-radius: 2px;
  background: var(--cp-info, #89b4fa);
  flex-shrink: 0;
}
.cp-quoteReply__content {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}
.cp-quoteReply__sender {
  color: var(--cp-info, #89b4fa);
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
}
.cp-quoteReply__preview {
  color: var(--cp-text-secondary, #a6adc8);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cp-coreText__reply {
  border-left: 3px solid color-mix(in oklab, var(--cp-info) 55%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-info) 8%, transparent);
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 8px;
}
.cp-coreText__reply[data-unavailable="true"] { opacity: 0.72; }
.cp-coreText__replyAuthor { font-size: 11px; color: var(--cp-text-muted); }
.cp-coreText__replyPreview { margin-top: 4px; font-size: 12px; color: var(--cp-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.cp-mentionList {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.cp-mentionTag {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  line-height: 1.4;
}
.cp-mention--user {
  background: color-mix(in oklab, var(--cp-info) 14%, transparent);
  color: color-mix(in oklab, var(--cp-info) 70%, var(--cp-text));
}
.cp-mention--everyone {
  color: var(--cp-danger, #e34);
  font-weight: 700;
  background: color-mix(in oklab, var(--cp-danger) 10%, transparent);
}
.cp-mention--here {
  color: var(--cp-warning, #f0a030);
  font-weight: 600;
  background: color-mix(in oklab, var(--cp-warning) 10%, transparent);
}
.cp-forwardedFrom {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  font-size: 11px;
  color: var(--cp-text-muted, #a6adc8);
}
.cp-forwardedFrom__icon {
  flex-shrink: 0;
}
.cp-forwardedFrom__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

