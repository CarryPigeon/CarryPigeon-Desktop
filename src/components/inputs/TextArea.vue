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
  <div class="text-area">
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
  grid-template-rows: 1fr;
  position: fixed;
  left: 319px;
  top: calc(100vh - 200px);
  width: calc(100% - 559px);
  height: 200px;
  opacity: 1;
  background: rgba(243, 244, 246, 1);
  border: 1px solid rgba(231, 232, 236, 1);
  box-sizing: border-box;
}

.text-area-item {
  font-size: 16px;
  //width: 53% !important
  //height: 95% !important
  margin: 20px 10px 5px 10px;
  border: none;
  background: transparent;
  outline: none;
  resize: none;
  box-sizing: border-box;
}
</style>
