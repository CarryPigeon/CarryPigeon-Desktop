<script setup lang="ts">
import { ref } from 'vue';
import MessageContextMenu from './MessageContextMenu.vue';
import { copyTextToClipboard } from '../../script/utils/clipboard';
import { dispatchForwardMessage } from '../../script/utils/messageEvents';

const props = defineProps<{
  name: string;
  avatar: string;
  message: string;
  date: string;
  messageId?: string | number;
}>();

const menuOpen = ref(false);
const menuX = ref(0);
const menuY = ref(0);

function onContextMenu(event: MouseEvent) {
  menuX.value = event.clientX;
  menuY.value = event.clientY;
  menuOpen.value = true;
}

async function handleCopy() {
  await copyTextToClipboard(props.message);
}

async function handleForward() {
  dispatchForwardMessage(props.message);
  await copyTextToClipboard(props.message);
}

function onMenuAction(action: 'copy' | 'recall' | 'forward') {
  if (action === 'copy') return void handleCopy();
  if (action === 'forward') return void handleForward();
}
</script>

<template>
  <div class="member-bubble">
    <div class="member-bubble-avatar">
      <img class="member-avatar" :src="props.avatar" alt="" />
    </div>
    <div class="member-name">{{ props.name }} - {{ props.date }}</div>
    <div class="member-bubble-content" @contextmenu.prevent="onContextMenu">{{ props.message }}</div>

    <MessageContextMenu v-model:open="menuOpen" :x="menuX" :y="menuY" @action="onMenuAction" />
  </div>
</template>

<style scoped lang="scss">
.member-bubble {
  display: flex;
  align-items: flex-start;
  margin-top: 5px;
  margin-bottom: 20px;
  margin-left: 5px;
  background: transparent;
}
.member-avatar {
  width: 40px;
  height: 40px;
  margin-right: 0;
  margin-top: 5px;
  border-radius: 50%;
  object-fit: cover;
}
.member-bubble-content {
  background: rgba(229, 231, 235, 1);
  border-radius: 10px;
  padding: 10px;
  margin-top: 20px;
  margin-left: -95px;

  max-width: 70%; // 防止消息过长挤占太多空间
}
.member-name {
  font-size: 14px;
  margin-top: 0;
  margin-left: 10px;
  margin-bottom: 0;
}
</style>
