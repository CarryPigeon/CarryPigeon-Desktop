<script setup lang="ts">
/**
 * @fileoverview UserMessageBubble.vue 文件职责说明。
 */

import { ref } from 'vue';
import { createChannelMessageService } from '@/features/channels/data/channelServiceFactory';
import { getServerSocket } from '@/features/servers/presentation/store/currentServer';
import MessageContextMenu from './MessageContextMenu.vue';
import { copyTextToClipboard } from '@/shared/utils/clipboard';
import { dispatchForwardMessage } from '@/shared/utils/messageEvents';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger("UserMessageBubble");

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
const hidden = ref(false);

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
 * handleRecall 方法说明。
 * @returns 返回值说明。
 */
async function handleRecall() {
  hidden.value = true;

  const rawId = props.messageId;
  const mid = typeof rawId === 'number' ? rawId : Number.parseInt(rawId ?? '', 10);
  if (!Number.isFinite(mid)) return;

  try {
    const serverSocket = getServerSocket();
    if (!serverSocket) {
      logger.warn("Missing server socket; recall skipped", { mid });
      return;
    }
    await createChannelMessageService(serverSocket).deleteMessage(mid);
  } catch (e) {
    logger.error("Recall failed", { mid, error: String(e) });
  }
}

/**
 * onMenuAction 方法说明。
 * @param action - 参数说明。
 * @returns 返回值说明。
 */
function onMenuAction(action: 'copy' | 'recall' | 'forward') {
  if (action === 'copy') return void handleCopy();
  if (action === 'forward') return void handleForward();
  void handleRecall();
}
</script>

<template>
  <!-- 组件：UserMessageBubble｜职责：自己消息气泡；交互：消息右键菜单（含撤回）/头像右键菜单 -->
  <!-- 区块：<div> .message-row -->
  <div v-if="!hidden" class="message-row message-row--outgoing" :class="{ compact: props.compact }">
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
        <span class="message-time">{{ props.timeLabel ?? props.date }}</span>
        <span class="message-dot">·</span>
        <span class="message-name">{{ props.name }}</span>
      </div>
      <!-- 区块：<div> .message-bubble -->
      <div
        class="message-bubble message-bubble--outgoing"
        :title="props.showMeta === false ? (props.timeLabel ?? props.date) : ''"
        @contextmenu.prevent="onContextMenu"
      >
        {{ props.message }}
      </div>
    </div>

    <MessageContextMenu
      v-model:open="menuOpen"
      :x="menuX"
      :y="menuY"
      :show-recall="true"
      @action="onMenuAction"
    />
  </div>
</template>

<style scoped lang="scss">
/* 样式：右侧消息气泡（靠右对齐） */
.message-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  justify-content: flex-end;
  --cp-signal: var(--cp-accent-2, var(--cp-accent));
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
  order: 2;
  background: var(--cp-hover-bg);
  border: 1px solid var(--cp-border-light);
}

.message-avatar-spacer {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  order: 2;
}

/* 样式：.message-stack */
.message-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: min(70%, 520px);
  align-items: flex-end;
  order: 1;
}

/* 样式：.message-meta */
.message-meta {
  font-size: 12px;
  color: var(--cp-text-muted, #737373);
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
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

/* 样式：.message-bubble--outgoing */
.message-bubble--outgoing {
  background:
    linear-gradient(180deg, var(--cp-accent-soft), transparent 78%),
    var(--cp-panel-muted);
  color: var(--cp-text, #1a1a1a);
  border: 1px solid var(--cp-border);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.20);
}
</style>
