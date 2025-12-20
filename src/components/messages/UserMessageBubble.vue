<script setup lang="ts">
import { ref } from 'vue';
import ChannelMessageService from '../../api/channel/Channel';
import { getServerSocket } from './messageContext';
import MessageContextMenu from './MessageContextMenu.vue';
import { copyTextToClipboard } from '../../script/utils/clipboard';
import { dispatchForwardMessage } from '../../script/utils/messageEvents';

const props = defineProps<{
  name: string;
  avatar: string;
  message: string;
  date: string;
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

function onContextMenu(event: MouseEvent) {
  menuX.value = event.clientX;
  menuY.value = event.clientY;
  menuOpen.value = true;
}

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

async function handleCopy() {
  await copyTextToClipboard(props.message);
}

async function handleForward() {
  dispatchForwardMessage(props.message);
  await copyTextToClipboard(props.message);
}

async function handleRecall() {
  hidden.value = true;

  const rawId = props.messageId;
  const mid = typeof rawId === 'number' ? rawId : Number.parseInt(rawId ?? '', 10);
  if (!Number.isFinite(mid)) return;

  try {
    await new ChannelMessageService(getServerSocket()).deleteMessage(mid);
  } catch {
    // ignore
  }
}

function onMenuAction(action: 'copy' | 'recall' | 'forward') {
  if (action === 'copy') return void handleCopy();
  if (action === 'forward') return void handleForward();
  void handleRecall();
}
</script>

<template>
  <div v-if="!hidden" class="member-bubble">
    <div class="member-bubble-content" @contextmenu.prevent="onContextMenu">{{ props.message }}</div>
    <div class="member-name">{{ props.date }} - {{ props.name }}</div>
    <div class="member-bubble-avatar">
      <img class="member-avatar" :src="props.avatar" alt="" @contextmenu.prevent="onAvatarContextMenu" />
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
.member-bubble {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  margin-top: 5px;
  margin-bottom: 20px;
  margin-right: 5px;
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
  background: rgba(224, 231, 255, 1);
  border-radius: 10px;
  padding: 10px;
  margin-top: 20px;
  margin-right: -100px;
  max-width: 70%;
}
// 防止消息过长挤占太多空间
.member-name {
  font-size: 14px;
  margin-top: 0;
  margin-right: 10px;
  margin-bottom: 0;
}
</style>
