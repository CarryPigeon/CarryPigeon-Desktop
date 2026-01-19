<script setup lang="ts">
import MessageBubbleComponents from './MessageBubbleComponents.vue';

const props = defineProps<{
  user_id: number;
}>();

const emit = defineEmits<{
  (e: "avatar-contextmenu", payload: { screenX: number; screenY: number; clientX: number; clientY: number; userId: number; name: string; avatar: string }): void;
}>();
</script>

<template>
  <div class="chat-box-container">
    <!-- 使用 v-for 遍历消息数组，动态渲染消息组件 -->
    <MessageBubbleComponents :user_id="props.user_id" @avatar-contextmenu="(payload) => emit('avatar-contextmenu', payload)" />
  </div>
</template>

<style scoped lang="scss">
.chat-box-container {
  background-color: transparent;
  position: fixed;
  top: 61px;
  // 动态计算左边距：ServerList(63px) + ChannelList 宽度
  left: calc(66px + var(--channel-list-width, 255px));
  // 使用全局高度变量同步调整聊天区域高度，默认为 200px
  height: calc(100vh - var(--chat-input-height, 200px) - 61px);
  // 动态计算宽度：总宽度 - ServerList(63px) - ChannelList 宽度 - ParticipantsList 宽度
  width: calc(100vw - 62px - var(--channel-list-width, 255px) - var(--participants-list-width, 240px));
  overflow-y: auto;
}
</style>
