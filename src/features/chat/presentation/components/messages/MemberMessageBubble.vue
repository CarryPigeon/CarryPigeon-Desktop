<script setup lang="ts">
/**
 * @fileoverview MemberMessageBubble.vue 文件职责说明。
 */

import { ref } from 'vue';
import MessageContextMenu from './MessageContextMenu.vue';
import { copyTextToClipboard } from '@/shared/utils/clipboard';
import { dispatchForwardMessage } from '@/shared/utils/messageEvents';

const props = defineProps<{
  name: string;
  avatar: string;
  message: string;
  date: string;
  timeLabel?: string;
  showMeta?: boolean;
  showAvatar?: boolean;
  compact?: boolean;
  messageId?: string | number;
  userId?: number;
}>();

const emit = defineEmits<{
  (e: "avatar-contextmenu", payload: { screenX: number; screenY: number; clientX: number; clientY: number; userId: number; name: string; avatar: string }): void;
}>();

const menuOpen = ref(false);
const menuX = ref(0);
const menuY = ref(0);

/**
 * onContextMenu 方法说明。
 * @param event - 参数说明。
 * @returns 返回值说明。
 */
function onContextMenu(event: MouseEvent) {
  menuX.value = event.clientX;
  menuY.value = event.clientY;
  menuOpen.value = true;
}

/**
 * onAvatarContextMenu 方法说明。
 * @param event - 参数说明。
 * @returns 返回值说明。
 */
function onAvatarContextMenu(event: MouseEvent) {
  if (!props.userId) return;
  emit("avatar-contextmenu", {
    screenX: event.screenX,
    screenY: event.screenY,
    clientX: event.clientX,
    clientY: event.clientY,
    userId: props.userId,
    name: props.name,
    avatar: props.avatar,
  });
}

/**
 * handleCopy 方法说明。
 * @returns 返回值说明。
 */
async function handleCopy() {
  await copyTextToClipboard(props.message);
}

/**
 * handleForward 方法说明。
 * @returns 返回值说明。
 */
async function handleForward() {
  dispatchForwardMessage(props.message);
  await copyTextToClipboard(props.message);
}

/**
 * onMenuAction 方法说明。
 * @param action - 参数说明。
 * @returns 返回值说明。
 */
function onMenuAction(action: 'copy' | 'recall' | 'forward') {
  if (action === 'copy') return void handleCopy();
  if (action === 'forward') return void handleForward();
}
</script>

<template>
  <!-- 组件：MemberMessageBubble｜职责：他人消息气泡；交互：消息右键菜单/头像右键菜单 -->
  <!-- 区块：<div> .message-row -->
  <div class="message-row message-row--incoming" :class="{ compact: props.compact }">
    <img
      v-if="props.showAvatar !== false"
      class="message-avatar"
      :src="props.avatar"
      alt=""
      @contextmenu.prevent="onAvatarContextMenu"
    />
    <div v-else class="message-avatar-spacer" aria-hidden="true"></div>
    <!-- 区块：<div> .message-stack -->
    <div class="message-stack">
      <!-- 区块：<div> .message-meta -->
      <div v-if="props.showMeta !== false" class="message-meta">
        <span class="message-name">{{ props.name }}</span>
        <span class="message-dot">·</span>
        <span class="message-time">{{ props.timeLabel ?? props.date }}</span>
      </div>
      <!-- 区块：<div> .message-bubble -->
      <div
        class="message-bubble message-bubble--incoming"
        :title="props.showMeta === false ? (props.timeLabel ?? props.date) : ''"
        @contextmenu.prevent="onContextMenu"
      >
        {{ props.message }}
      </div>
    </div>

    <MessageContextMenu v-model:open="menuOpen" :x="menuX" :y="menuY" @action="onMenuAction" />
  </div>
</template>

<style scoped lang="scss">
/* 样式：左侧消息气泡（含头像与时间/昵称） */
.message-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  --cp-signal: var(--cp-domain-core, var(--cp-accent));
}

.message-row.compact {
  margin-top: -6px;
}

/* 样式：.message-avatar */
.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 14px;
  object-fit: cover;
  background: var(--cp-hover-bg);
  border: 1px solid var(--cp-border-light);
}

.message-avatar-spacer {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
}

/* 样式：.message-stack */
.message-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: min(70%, 520px);
}

/* 样式：.message-meta */
.message-meta {
  font-size: 12px;
  color: var(--cp-text-muted, #737373);
  display: flex;
  gap: 6px;
  align-items: center;
}

/* 样式：.message-name */
.message-name {
  font-weight: 500;
  color: var(--cp-text, #1a1a1a);
}

/* 样式：.message-bubble */
.message-bubble {
  position: relative;
  padding: 10px 14px;
  border-radius: var(--cp-radius-lg, 8px);
  line-height: 1.5;
  font-size: 14px;
  word-break: break-word;
}

.message-bubble::before {
  content: "";
  position: absolute;
  left: -1px;
  top: -1px;
  bottom: -1px;
  width: 2px;
  background: var(--cp-signal);
  border-radius: 14px 0 0 14px;
  opacity: 0.9;
}

/* 样式：.message-bubble--incoming */
.message-bubble--incoming {
  background: var(--cp-surface);
  color: var(--cp-text, #1a1a1a);
  border: 1px solid var(--cp-border-light);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
}
</style>
