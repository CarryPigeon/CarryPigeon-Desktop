<script setup lang="ts">
/**
 * @fileoverview ChannelContextMenu.vue
 * @description 频道右键菜单：静音/取消静音、频道信息、标为已读。
 */

import { useI18n } from "vue-i18n";
import type { ChannelContextAction } from "@/features/chat/presentation/patchbay/interactions/useChannelContextMenu";

const props = defineProps<{
  open: boolean;
  x: number;
  y: number;
  isMuted: boolean;
}>();

const emit = defineEmits<{
  action: [action: ChannelContextAction];
  close: [];
}>();

const { t } = useI18n();

function onAction(action: ChannelContextAction): void {
  emit("action", action);
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="cp-contextMenu cp-channelContextMenu"
      :style="{ position: 'fixed', left: `${x}px`, top: `${y}px`, zIndex: 9999 }"
      @click.stop
    >
      <button class="cp-contextMenu__item" type="button" @click="onAction('channel_info')">
        {{ t("channel_info") }}
      </button>
      <button class="cp-contextMenu__item" type="button" @click="onAction('mark_read')">
        {{ t("channel_mark_read") }}
      </button>
      <div class="cp-contextMenu__sep" />
      <button
        class="cp-contextMenu__item"
        :class="{ 'cp-contextMenu__item--danger': !isMuted }"
        type="button"
        @click="onAction(isMuted ? 'unmute' : 'mute')"
      >
        {{ isMuted ? t("channel_unmute") : t("channel_mute") }}
      </button>
    </div>
    <!-- 点击遮罩关闭菜单 -->
    <div v-if="open" class="cp-contextMenu__backdrop" @click="emit('close')" />
  </Teleport>
</template>

<style scoped lang="scss">
.cp-channelContextMenu {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 14px;
  box-shadow: var(--cp-shadow-float);
  padding: 6px;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cp-contextMenu__item {
  border: none;
  background: transparent;
  color: var(--cp-text);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--cp-fast) var(--cp-ease);

  &:hover {
    background: var(--cp-hover-bg);
  }

  &--danger {
    color: var(--cp-danger);
  }
}

.cp-contextMenu__sep {
  height: 1px;
  background: var(--cp-border);
  margin: 4px 8px;
}

.cp-contextMenu__backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
}
</style>
