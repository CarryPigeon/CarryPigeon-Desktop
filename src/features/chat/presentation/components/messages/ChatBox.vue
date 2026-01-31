<script setup lang="ts">
/**
 * @fileoverview ChatBox.vue 文件职责说明。
 */

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import MessageBubbleComponents from './MessageBubbleComponents.vue';
import { activeMessageContext, messageList } from "../../store/messageList";

const props = defineProps<{
  user_id: number;
}>();

const emit = defineEmits<{
  (e: "avatar-contextmenu", payload: { screenX: number; screenY: number; clientX: number; clientY: number; userId: number; name: string; avatar: string }): void;
}>();

const scrollerRef = ref<HTMLElement | null>(null);
const atBottom = ref(true);
const unreadCount = ref(0);

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= 56;
}

function scrollToBottom(behavior: ScrollBehavior = "auto"): void {
  const el = scrollerRef.value;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior });
}

function onScroll(): void {
  const el = scrollerRef.value;
  if (!el) return;
  atBottom.value = isNearBottom(el);
  if (atBottom.value) unreadCount.value = 0;
}

watch(
  () => messageList.value.length,
  async (nextLen, prevLen) => {
    if (nextLen <= prevLen) return;
    await nextTick();
    const el = scrollerRef.value;
    if (!el) return;

    if (isNearBottom(el)) {
      atBottom.value = true;
      unreadCount.value = 0;
      scrollToBottom("auto");
      return;
    }

    atBottom.value = false;
    unreadCount.value += nextLen - prevLen;
  },
);

watch(
  activeMessageContext,
  async () => {
    unreadCount.value = 0;
    await nextTick();
    scrollToBottom("auto");
  },
  { deep: true },
);

onMounted(() => {
  const el = scrollerRef.value;
  if (el) {
    atBottom.value = isNearBottom(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    scrollToBottom("auto");
  }
});

onBeforeUnmount(() => {
  scrollerRef.value?.removeEventListener("scroll", onScroll);
});
</script>

<template>
  <!-- 组件：ChatBox｜职责：消息列表容器；变量：--chat-input-height/--channel-list-width/--participants-list-width -->
  <!-- 区块：<div> .chat-box-container -->
  <div ref="scrollerRef" class="chat-box-container">
    <!-- 使用 v-for 遍历消息数组，动态渲染消息组件 -->
    <MessageBubbleComponents :user_id="props.user_id" @avatar-contextmenu="(payload) => emit('avatar-contextmenu', payload)" />

    <div v-if="unreadCount > 0 && !atBottom" class="jump-latest">
      <button class="jump-btn" type="button" @click="scrollToBottom('smooth')">
        {{ unreadCount }} 条新消息 · 回到底部
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：聊天区域（嵌在玻璃 ChatPane 面板中） */
.chat-box-container {
  background: transparent;
  position: relative;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 14px 12px 16px;
}

.jump-latest {
  position: sticky;
  bottom: 12px;
  display: flex;
  justify-content: center;
  padding: 0 12px 12px;
  pointer-events: none;
}

.jump-btn {
  pointer-events: auto;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 10px 14px;
  font-size: 12px;
  cursor: pointer;
  box-shadow: var(--cp-shadow-soft);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  transition: transform var(--cp-fast, 160ms) var(--cp-ease, ease);

  &:hover {
    transform: translateY(-1px);
  }
}
</style>
