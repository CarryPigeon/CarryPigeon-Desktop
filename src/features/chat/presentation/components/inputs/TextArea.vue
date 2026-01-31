<script setup lang="ts">
/**
 * @fileoverview TextArea.vue 文件职责说明。
 */

import { onMounted, onUnmounted, ref, nextTick, watch } from "vue";
import { createChannelMessageService } from "@/features/channels/data/channelServiceFactory";
import { userData } from "@/features/user/presentation/store/userData";
import { getServerSocket } from "@/features/servers/presentation/store/currentServer";
import {
  FORWARD_MESSAGE_EVENT,
  INSERT_TEXT_EVENT,
  type ForwardMessageEventDetail,
  type InsertTextEventDetail,
} from "@/shared/utils/messageEvents";
import { addMessage } from "../../store/messageList";
import { getChannelId } from "../../store/chatContext";
import { createLogger } from "@/shared/utils/logger";

const text = ref('');
const logger = createLogger("TextArea");
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// 自动调整textarea高度
/**
 * adjustHeight 方法说明。
 * @returns 返回值说明。
 */
const adjustHeight = () => {
  const textarea = textareaRef.value;
  if (!textarea) return;

  // 重置高度以获取正确的scrollHeight
  textarea.style.height = 'auto';
  // 限制最大高度为110px（更紧凑）
  const newHeight = Math.min(textarea.scrollHeight, 110);
  textarea.style.height = `${newHeight}px`;
};

watch(text, () => {
  nextTick(adjustHeight);
});

/**
 * onForwardMessage 方法说明。
 * @param event - 参数说明。
 * @returns 返回值说明。
 */
const onForwardMessage = (event: Event) => {
  const custom = event as CustomEvent<ForwardMessageEventDetail>;
  const content = custom.detail?.content;
  if (!content) return;

  text.value = content;
  requestAnimationFrame(() => {
    textareaRef.value?.focus();
  });
};

/**
 * onInsertText 方法说明。
 * @param event - 参数说明。
 * @returns 返回值说明。
 */
const onInsertText = (event: Event) => {
  const custom = event as CustomEvent<InsertTextEventDetail>;
  const content = custom.detail?.content;
  if (!content) return;
  const mode = custom.detail?.mode ?? 'append';

  const textarea = textareaRef.value;
  if (!textarea) {
    text.value = mode === 'prepend' ? `${content}${text.value}` : mode === 'replace' ? content : `${text.value}${content}`;
    return;
  }

  if (mode === 'replace') {
    text.value = content;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(text.value.length, text.value.length);
    });
    return;
  }

  if (mode === 'prepend') {
    text.value = `${content}${text.value}`;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(content.length, content.length);
    });
    return;
  }

  const start = textarea.selectionStart ?? text.value.length;
  const end = textarea.selectionEnd ?? start;
  text.value = `${text.value.slice(0, start)}${content}${text.value.slice(end)}`;
  const nextPos = start + content.length;
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(nextPos, nextPos);
  });
};


onMounted(() => {
  window.addEventListener(FORWARD_MESSAGE_EVENT, onForwardMessage);
  window.addEventListener(INSERT_TEXT_EVENT, onInsertText);
  adjustHeight();
});

onUnmounted(() => {
  window.removeEventListener(FORWARD_MESSAGE_EVENT, onForwardMessage);
  window.removeEventListener(INSERT_TEXT_EVENT, onInsertText);
});

/**
 * sendMessage 方法说明。
 * @returns 返回值说明。
 */
async function sendMessage() {
  if (text.value.trim().length === 0) {
    return;
  }

  const content = text.value;
  const serverSocket = getServerSocket();
  const channelId = getChannelId();

  // Optimistic UI: append immediately.
  addMessage({
    id: String(Date.now()),
    from_id: userData.getId(),
    name: userData.getUsername(),
    avatar: userData.getAvatar(),
    content,
    timestamp: new Date().toISOString(),
  }, serverSocket, channelId);

  text.value = '';
  nextTick(adjustHeight);

  if (!serverSocket) {
    logger.warn("Missing server socket; message not sent");
    return;
  }
  if (!channelId) {
    logger.warn("Missing channel id; message not sent");
    return;
  }

  try {
    const sender = createChannelMessageService(serverSocket);
    await sender.sendMessage(channelId, content);
  } catch (e) {
    logger.error("Send message failed", { error: String(e) });
  }
}

/**
 * handleKeydown 方法说明。
 * @param event - 参数说明。
 * @returns 返回值说明。
 */
function handleKeydown(event: KeyboardEvent) {
  // Enter发送，Shift+Enter换行
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}
</script>

<template>
  <!-- 组件：TextArea｜职责：Telegram风格聊天输入框 -->
  <!-- 区块：<div> .input-container -->
  <div class="input-container">
    <!-- 区块：<div> .input-wrapper -->
    <div class="input-wrapper">
      <textarea
        ref="textareaRef"
        v-model="text"
        class="message-input"
        placeholder="输入消息..."
        rows="1"
        @keydown="handleKeydown"
      ></textarea>
      <!-- 区块：<button> -->
      <button
        class="send-button"
        :class="{ active: text.trim().length > 0 }"
        :disabled="text.trim().length === 0"
        @click="sendMessage"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 输入区（嵌在玻璃 InputPane 面板中） */
.input-container {
  padding: 10px 12px;
  background: transparent;
}

/* 样式：.input-wrapper */
.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--cp-field-bg);
  border: 1px solid var(--cp-field-border);
  border-radius: var(--cp-radius, 14px);
  padding: 6px 8px 6px 10px;
  transition:
    border-color var(--cp-fast, 160ms) var(--cp-ease, ease),
    box-shadow var(--cp-fast, 160ms) var(--cp-ease, ease),
    background-color var(--cp-fast, 160ms) var(--cp-ease, ease);

  /* 样式：&:focus-within */
  &:focus-within {
    border-color: var(--cp-accent);
    box-shadow: var(--cp-ring);
  }

  &:hover {
    border-color: var(--cp-field-border-hover);
    background: var(--cp-field-bg-hover);
  }
}

/* 样式：.message-input */
.message-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 1.35;
  color: var(--cp-text, #1a1a1a);
  min-height: 18px;
  max-height: 110px;
  padding: 6px 6px 6px 2px;
  font-family: inherit;
  caret-color: var(--cp-accent);

  /* 样式：&::placeholder */
  &::placeholder {
    color: var(--cp-field-placeholder);
  }
}

/* 样式：.send-button */
.send-button {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--cp-text-muted, #737373);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color var(--cp-fast, 160ms) var(--cp-ease, ease),
    color var(--cp-fast, 160ms) var(--cp-ease, ease),
    transform var(--cp-fast, 160ms) var(--cp-ease, ease);

  /* 样式：&:disabled */
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  /* 样式：&.active */
  &.active {
    background: linear-gradient(180deg, var(--cp-accent), var(--cp-accent-hover));
    color: #ffffff;
    box-shadow: 0 12px 26px var(--cp-accent-shadow);

    /* 样式：&:hover */
    &:hover {
      transform: translateY(-1px);
    }
  }
}
</style>
