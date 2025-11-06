<script setup lang="ts">
import {h, onMounted, ref, render} from "vue";
import UserMessageBubble from '../messages/UserMessageBubble.vue';
import {ChannelMessageService} from "../../api/channel/Channel.ts";
import { userData } from "../../script/struct/UserData.ts";

let container:HTMLElement | null = null;
const text = ref('');

onMounted(() => {
  container = document.querySelector('.chat-box-container');
});

function sendMessage() {
  if (text.value.length == 0) {
    return;
  }
  const sender = new ChannelMessageService();
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
    text.value = '';

    // 自动滚动到底部
    requestAnimationFrame(() => {
      container!.scrollTop = container!.scrollHeight;
    });
  }
}
</script>

<template>
  <div class="text-area">
    <textarea
        id="text-area-item"
        v-model="text"
        placeholder=""
        class="text-area-item"
        wrap="soft"
        @keydown.enter="sendMessage"
    ></textarea>
  </div>
</template>

<style scoped lang="sass">
.text-area
  display: grid
  grid-template-columns: 1fr
  grid-template-rows: 1fr
  position: fixed
  left: 319px
  top: calc(100vh - 100px)
  width: calc(100vw - 558px)
  height: 100px
  opacity: 1
  background: rgba(243, 244, 246, 1)
  border: 1px solid rgba(231, 232, 236, 1)
  box-sizing: border-box

.text-area-item
  width: 98% !important
  height: 95% !important
  margin: 10px 10px 5px
  border: none
  background: transparent
  outline: none
  resize: none
  box-sizing: border-box
</style>