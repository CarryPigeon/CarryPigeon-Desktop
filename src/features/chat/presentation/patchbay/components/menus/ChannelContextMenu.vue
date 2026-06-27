<script setup lang="ts">
/**
 * @fileoverview 频道右键菜单｜频道设置/通知级别/定时静音子菜单。
 * @description chat｜presentation component：频道右键菜单。
 */
import { useI18n } from "vue-i18n";
import type { ChannelContextAction } from "@/features/chat/presentation/patchbay/interactions/useChannelContextMenu";
import type { NotificationLevel } from "@/features/chat/presentation/patchbay/view-models/useChannelMuteStore";
import {
  MUTE_DURATION_1H,
  MUTE_DURATION_8H,
  MUTE_DURATION_24H,
  MUTE_DURATION_FOREVER,
} from "@/features/chat/presentation/patchbay/view-models/useChannelMuteStore";

const props = defineProps<{
  open: boolean;
  x: number;
  y: number;
  notificationLevel: NotificationLevel;
}>();

const emit = defineEmits<{
  action: [action: ChannelContextAction];
  close: [];
}>();

const { t } = useI18n();

const levels: { key: NotificationLevel; labelKey: string }[] = [
  { key: "all", labelKey: "notif_level_all" },
  { key: "mentions_only", labelKey: "notif_level_mentions_only" },
  { key: "muted", labelKey: "notif_level_muted" },
];

const muteDurations: { key: ChannelContextAction; labelKey: string }[] = [
  { key: `mute_for:${MUTE_DURATION_1H}`, labelKey: "mute_for_1h" },
  { key: `mute_for:${MUTE_DURATION_8H}`, labelKey: "mute_for_8h" },
  { key: `mute_for:${MUTE_DURATION_24H}`, labelKey: "mute_for_24h" },
  { key: `mute_for:${MUTE_DURATION_FOREVER}`, labelKey: "mute_for_manual" },
];

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
      <div class="cp-contextMenu__label">{{ t("notif_level") }}</div>
      <button
        v-for="lv in levels"
        :key="lv.key"
        class="cp-contextMenu__item"
        :class="{
          'cp-contextMenu__item--active': notificationLevel === lv.key,
          'cp-contextMenu__item--danger': lv.key === 'muted',
        }"
        type="button"
        @click="onAction(`level:${lv.key}`)"
      >
        <span class="cp-contextMenu__radio" :class="{ 'cp-contextMenu__radio--checked': notificationLevel === lv.key }" />
        {{ t(lv.labelKey) }}
      </button>
      <div class="cp-contextMenu__sep" />
      <div class="cp-contextMenu__label">{{ t("mute_for") }}</div>
      <button
        v-for="d in muteDurations"
        :key="d.key"
        class="cp-contextMenu__item"
        type="button"
        @click="onAction(d.key)"
      >
        {{ t(d.labelKey) }}
      </button>
    </div>
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
  min-width: 200px;
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
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background: var(--cp-hover-bg);
  }

  &--danger {
    color: var(--cp-danger);
  }

  &--active {
    background: var(--cp-hover-bg);
  }
}

.cp-contextMenu__radio {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--cp-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &--checked {
    border-color: var(--cp-accent);
    background: var(--cp-accent);
  }
}

.cp-contextMenu__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--cp-text-tertiary);
  padding: 6px 12px 2px;
  letter-spacing: 0.5px;
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
