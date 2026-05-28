<script setup lang="ts">
/**
 * @fileoverview ThreadRootCard.vue
 * @description chat｜ThreadPanel 根消息卡片。
 */

import type { ChatMessageRecord } from "@/features/chat/domain/types/chatApiModels";

defineProps<{ message: ChatMessageRecord }>();
</script>

<template>
  <div class="cp-threadRoot">
    <div class="cp-threadRoot__sender">{{ message.sender?.nickname ?? message.userId }}</div>
    <div class="cp-threadRoot__text">{{ (message as any).preview ?? "(message)" }}</div>
  </div>
</template>

<style scoped>
.cp-threadRoot {
  padding: 12px;
  border: 1px solid var(--cp-border);
  border-radius: 14px;
  background: var(--cp-panel-muted);
  margin-bottom: 12px;
}
.cp-threadRoot__sender { font-size: 12px; font-weight: 600; margin-bottom: 4px; color: var(--cp-text); }
.cp-threadRoot__text { font-size: 13px; color: var(--cp-text); }
</style>
