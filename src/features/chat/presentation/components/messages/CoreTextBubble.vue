<script setup lang="ts">
/**
 * @fileoverview CoreTextBubble.vue
 * @description Core-text 消息气泡：支持 `[file:{share_key}]` token 的分段渲染与附件气泡展示。
 */

import { FileMessageBubble } from "@/features/files/api";
import { hasFileToken, parseCoreTextParts } from "@/features/chat/presentation/utils/coreTextToken";

const props = defineProps<{
  /**
   * 消息 id（用于构造 token 分段的 key）。
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
  <!-- 组件：CoreTextBubble｜职责：渲染 core-text 消息（含文件 token） -->
  <!-- 区块：<div> .cp-bubble -->
  <div class="cp-bubble">
    <!-- 区块：引用预览（安全降级：缺失/被删回退为 "—"） -->
    <div v-if="props.replyText" class="cp-replyMini">
      <div class="cp-replyMini__k">reply</div>
      <div class="cp-replyMini__v">{{ props.replyText }}</div>
    </div>

    <template v-if="hasFileToken(props.text)">
      <template v-for="(p, idx) in parseCoreTextParts(props.text)" :key="`${props.messageId}-${idx}`">
        <span v-if="p.kind === 'text'">{{ p.text }}</span>
        <FileMessageBubble v-else :filename="p.shareKey" :share-key="p.shareKey" />
      </template>
    </template>
    <template v-else>{{ props.text }}</template>
  </div>
</template>
