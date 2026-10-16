<script setup lang="ts">
/**
 * @fileoverview 频道右键菜单｜频道设置/通知级别/定时静音子菜单。
 * @description chat｜presentation component：频道右键菜单。
 */
import { useI18n } from "vue-i18n";
import ContextMenuSurface from "@/shared/ui/contextMenu/ContextMenuSurface.vue";
import ContextMenuItem from "@/shared/ui/contextMenu/ContextMenuItem.vue";
import ContextMenuSeparator from "@/shared/ui/contextMenu/ContextMenuSeparator.vue";
import ContextMenuLabel from "@/shared/ui/contextMenu/ContextMenuLabel.vue";
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
  /** 当前频道是否已置顶（本地 JSON）。 */
  pinned: boolean;
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
  <ContextMenuSurface
    :open="props.open"
    :x="props.x"
    :y="props.y"
    :min-width="200"
    @close="emit('close')"
  >
    <ContextMenuItem @select="onAction('channel_info')">
      {{ t("channel_info") }}
    </ContextMenuItem>
    <ContextMenuItem @select="onAction('toggle_pin')">
      {{ props.pinned ? t("unpin_channel") : t("pin_channel") }}
    </ContextMenuItem>
    <ContextMenuItem @select="onAction('mark_read')">
      {{ t("channel_mark_read") }}
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuLabel>{{ t("notif_level") }}</ContextMenuLabel>
    <ContextMenuItem
      v-for="lv in levels"
      :key="lv.key"
      :active="notificationLevel === lv.key"
      :danger="lv.key === 'muted'"
      @select="onAction(`level:${lv.key}`)"
    >
      <span class="cp-channelCtxRadio" :class="{ 'cp-channelCtxRadio--checked': notificationLevel === lv.key }" />
      {{ t(lv.labelKey) }}
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuLabel>{{ t("mute_for") }}</ContextMenuLabel>
    <ContextMenuItem
      v-for="d in muteDurations"
      :key="d.key"
      @select="onAction(d.key)"
    >
      {{ t(d.labelKey) }}
    </ContextMenuItem>
  </ContextMenuSurface>
</template>

<style scoped lang="scss">
/* 样式：ChannelContextMenu｜仅保留通知级别单选圆点（菜单外观由共享基元提供） */
.cp-channelCtxRadio {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--cp-text-light);
  flex-shrink: 0;
}

.cp-channelCtxRadio--checked {
  border-color: var(--cp-accent);
  background: var(--cp-accent);
}
</style>
