<script setup lang="ts">
/**
 * @fileoverview CoreTextMessageBubble.vue
 * @description
 * message-flow/message｜Core:Text 消息气泡（支持 `[file:share_key]` token 分段渲染）。
 */

import FileRefMessageBubble from "./FileRefMessageBubble.vue";
import { hasFileToken, parseCoreTextParts } from "@/features/chat/message-flow/message/domain/coreTextFileSyntax";

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
}>();
</script>

<template>
  <!-- 组件：CoreTextMessageBubble｜职责：渲染 core-text（文本 + 文件引用 token） -->
  <div class="cp-bubble">
    <div v-if="props.replyText" class="cp-replyMini">
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
  </div>
</template>

