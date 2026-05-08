<script setup lang="ts">
/**
 * @fileoverview CreateChatMenu.vue
 * @description chat｜创建入口菜单（新建群聊 / 创建好友私聊）。
 */

import { onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  open: boolean;
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "group"): void;
  (e: "private"): void;
}>();

const { t } = useI18n();

function runAndClose(fn: () => void): void {
  fn();
  emit("close");
}

function onGlobalKeydown(e: KeyboardEvent): void {
  if (!props.open) return;
  if (e.key !== "Escape") return;
  e.preventDefault();
  emit("close");
}

onMounted(() => window.addEventListener("keydown", onGlobalKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onGlobalKeydown));
</script>

<template>
  <!-- 组件：CreateChatMenu｜职责：创建聊天入口菜单 -->
  <teleport to="body">
    <div
      v-if="props.open"
      class="cp-channelMenu"
      :style="{ left: `${props.x}px`, top: `${props.y}px` }"
      role="menu"
      :aria-label="t('create_chat')"
      @click.stop
    >
      <button class="cp-channelMenu__item" type="button" role="menuitem" @click="runAndClose(() => emit('group'))">
        {{ t("create_group_chat") }}
      </button>
      <button class="cp-channelMenu__item" type="button" role="menuitem" @click="runAndClose(() => emit('private'))">
        {{ t("create_friend_private_chat") }}
      </button>
    </div>
    <div v-if="props.open" class="cp-channelMenu__backdrop" @click="emit('close')"></div>
  </teleport>
</template>
