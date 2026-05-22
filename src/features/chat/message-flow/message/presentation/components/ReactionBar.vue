<script setup lang="ts">
/**
 * @fileoverview 消息回应栏 — 消息下方展示 Emoji 回应列表及添加入口。
 */

import { ref } from "vue";
import type { MessageReactionSummary } from "@/features/chat/message-flow/api-types";

const props = defineProps<{
  messageId: string;
  reactions: MessageReactionSummary[];
  onReact: (messageId: string, emoji: string) => void;
}>();

const showQuickBar = ref(false);
const quickEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function handleReactionClick(emoji: string) {
  props.onReact(props.messageId, emoji);
  showQuickBar.value = false;
}

function toggleQuickBar() {
  showQuickBar.value = !showQuickBar.value;
}
</script>

<template>
  <div class="cp-reactionBar">
    <span
      v-for="r in reactions"
      :key="r.emoji"
      class="cp-reactionBadge"
      :class="{ 'cp-reactionBadge--mine': r.reactedByMe }"
      @click="handleReactionClick(r.emoji)"
    >
      {{ r.emoji }}&nbsp;{{ r.count }}
    </span>

    <button class="cp-reactionAddBtn" @click.stop="toggleQuickBar">+</button>

    <div v-if="showQuickBar" class="cp-quickBar">
      <span
        v-for="emoji in quickEmojis"
        :key="emoji"
        class="cp-quickBar__item"
        @click="handleReactionClick(emoji)"
      >
        {{ emoji }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.cp-reactionBar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  flex-wrap: wrap;
  position: relative;
}

.cp-reactionBadge {
  font-size: 13px;
  background: var(--cp-bg-2);
  border-radius: 12px;
  padding: 2px 8px;
  cursor: pointer;
  user-select: none;
  border: 1px solid transparent;
  transition: background var(--cp-fast) var(--cp-ease), transform var(--cp-fast) var(--cp-ease);
}

.cp-reactionBadge:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg-2);
}

.cp-reactionBadge--mine {
  border-color: var(--cp-accent-soft);
  background: color-mix(in oklab, var(--cp-accent-soft) 60%, var(--cp-bg-2));
}

.cp-reactionAddBtn {
  font-size: 14px;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: 1px dashed var(--cp-border);
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cp-text-muted);
  transition: background var(--cp-fast) var(--cp-ease), transform var(--cp-fast) var(--cp-ease);
}

.cp-reactionAddBtn:hover {
  background: var(--cp-hover-bg);
  transform: translateY(-1px);
}

.cp-quickBar {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  display: flex;
  gap: 2px;
  background: var(--cp-panel);
  border: 1px solid var(--cp-border);
  border-radius: 16px;
  padding: 6px 8px;
  box-shadow: var(--cp-shadow-soft);
  z-index: 10;
}

.cp-quickBar__item {
  font-size: 22px;
  cursor: pointer;
  padding: 4px;
  border-radius: 10px;
  line-height: 1;
  transition: background var(--cp-fast) var(--cp-ease), transform var(--cp-fast) var(--cp-ease);
}

.cp-quickBar__item:hover {
  background: var(--cp-hover-bg);
  transform: scale(1.15);
}
</style>
