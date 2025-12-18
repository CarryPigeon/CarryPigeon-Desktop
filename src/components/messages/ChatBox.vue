<script setup lang="ts">
import MessageBubbleComponents from './MessageBubbleComponents.vue';

const props = defineProps<{
  user_id: number;
}>();
</script>

<template>
  <div class="chat-box-container">
    <!-- 使用 v-for 遍历消息数组，动态渲染消息组件 -->
    <MessageBubbleComponents :user_id="props.user_id" />
  </div>
</template>

<style scoped lang="scss">
.chat-box-container {
  background-color: transparent;
  position: fixed;
  top: 61px;
  left: 318px;
  height: calc(65vh - 15px);
  width: calc(100vw - 558px);
  overflow-y: auto;
}
</style>
