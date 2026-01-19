<script setup lang="ts">
import {h, onMounted, onUnmounted, ref, render} from "vue";
import UserMessageBubble from '../messages/UserMessageBubble.vue';
import ChannelMessageService from "../../api/channel/Channel.ts";
import { userData } from "../../script/struct/UserData.ts";
import { getServerSocket } from "../messages/messageContext";
import {
  FORWARD_MESSAGE_EVENT,
  INSERT_TEXT_EVENT,
  type ForwardMessageEventDetail,
  type InsertTextEventDetail,
} from "../../script/utils/messageEvents";

let container:HTMLElement | null = null;
const text = ref('');

// 文本框初始高度
const textAreaHeight = ref(200);
// 是否正在调整大小
const isResizing = ref(false);

/**
 * 开始调整文本框高度
 * @param e 鼠标事件
 */
const startResize = (e: MouseEvent) => {
  isResizing.value = true;
  // 添加全局事件监听，确保鼠标移出调整条也能继续拖拽
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
  // 阻止默认行为，防止拖拽时选中文本
  e.preventDefault();
};

/**
 * 处理鼠标移动，实时更新高度
 * @param e 鼠标事件
 */
const handleResize = (e: MouseEvent) => {
  if (!isResizing.value) return;
  
  // 计算新的高度：视口总高度减去当前鼠标的 Y 坐标
  const newHeight = window.innerHeight - e.clientY;
  
  // 限制文本框的最小高度（100px）和最大高度（视口高度的 80%）
  if (newHeight >= 100 && newHeight <= window.innerHeight * 0.8) {
    textAreaHeight.value = newHeight;
    // 更新全局 CSS 变量，以便 ChatBox 同步调整其高度，避免内容重叠
    document.documentElement.style.setProperty('--chat-input-height', `${newHeight}px`);
  }
};

/**
 * 停止调整大小，移除事件监听
 */
const stopResize = () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
};

const onForwardMessage = (event: Event) => {
  const custom = event as CustomEvent<ForwardMessageEventDetail>;
  const content = custom.detail?.content;
  if (!content) return;

  text.value = content;
  requestAnimationFrame(() => {
    document.getElementById('text-area-item')?.focus();
  });
};

const onInsertText = (event: Event) => {
  const custom = event as CustomEvent<InsertTextEventDetail>;
  const content = custom.detail?.content;
  if (!content) return;
  const mode = custom.detail?.mode ?? 'append';

  const textarea = document.getElementById('text-area-item') as HTMLTextAreaElement | null;
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
  // 初始化全局高度变量
  document.documentElement.style.setProperty('--chat-input-height', `${textAreaHeight.value}px`);
  container = document.querySelector('.chat-box-container');
  window.addEventListener(FORWARD_MESSAGE_EVENT, onForwardMessage);
  window.addEventListener(INSERT_TEXT_EVENT, onInsertText);
});

onUnmounted(() => {
  window.removeEventListener(FORWARD_MESSAGE_EVENT, onForwardMessage);
  window.removeEventListener(INSERT_TEXT_EVENT, onInsertText);
});

function sendMessage() {
  if (text.value.length == 0) {
    return;
  }
  const sender = new ChannelMessageService(getServerSocket());
  sender.sendMessage(1,text.value);
  let date = new Date().toDateString();
  let vNode = h(UserMessageBubble, {
    name: userData.getUsername(),
    message: text.value,
    avatar: userData.getAvatar(),
    date: date,
  });

  let renderer = document.createElement("div");
  render(vNode, renderer);
  // 获取真实DOM并添加到容器
  if (container && renderer.firstChild) {
    container.appendChild(renderer.firstChild);

    // 自动滚动到底部
    requestAnimationFrame(() => {
      container!.scrollTop = container!.scrollHeight;
    });
    text.value = '';
  }
}
</script>

<template>
  <div 
    class="text-area" 
    :style="{ 
      height: textAreaHeight + 'px', 
      top: `calc(100vh - ${textAreaHeight}px)` 
    }"
  >
    <!-- 高度调节手柄 -->
    <div class="resizer" @mousedown="startResize"></div>
    <textarea
        id="text-area-item"
        v-model="text"
        class="text-area-item"
        wrap="soft"
        @keydown.enter.prevent="sendMessage"
    ></textarea>
  </div>
</template>

<style scoped lang="scss">
.text-area {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto 1fr; // 第一行给 resizer，第二行给 textarea
  position: fixed;
  // 动态计算左边距：ServerList(63px) + ChannelList 宽度
  left: calc(66px + var(--channel-list-width, 255px));
  // 动态计算宽度：总宽度 - ServerList(63px) - ChannelList 宽度 - ParticipantsList 宽度
  width: calc(100vw - 59px - var(--channel-list-width, 255px) - var(--participants-list-width, 240px));
  opacity: 1;
  background: rgba(243, 244, 246, 1);
  border: 1px solid rgba(231, 232, 236, 1);
  box-sizing: border-box;
  z-index: 10;
}

// 调节高度的手柄样式
.resizer {
  height: 4px;
  width: 100%;
  cursor: ns-resize; // 显示上下调节的光标
  background: transparent;
  transition: background 0.2s;
  
  &:hover {
    background: rgba(0, 0, 0, 0.1); // 悬浮时显示浅色条
  }
}

.text-area-item {
  font-size: 16px;
  margin: 16px 10px 5px 10px; // 稍微调整 margin，因为有了 resizer
  border: none;
  background: transparent;
  outline: none;
  resize: none;
  box-sizing: border-box;
}
</style>
