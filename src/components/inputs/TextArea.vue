<script setup lang="ts">
import {h, onMounted, ref, render} from "vue";
import UserMessageBubble from '../messages/UserMessageBubble.vue';
import ChannelMessageService from "../../api/channel/Channel.ts";
import { userData } from "../../script/struct/UserData.ts";
import { getServerSocket } from "../messages/ChatBox.vue";

let container:HTMLElement | null = null;
const text = ref('');

onMounted(() => {
  container = document.querySelector('.chat-box-container');
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