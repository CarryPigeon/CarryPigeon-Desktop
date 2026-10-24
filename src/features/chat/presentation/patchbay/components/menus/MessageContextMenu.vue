<script setup lang="ts">
/**
 * @fileoverview MessageContextMenu.vue
 * @description chat｜组件：MessageContextMenu。
 */

import { useI18n } from "vue-i18n";
import ContextMenuSurface from "@/shared/ui/contextMenu/ContextMenuSurface.vue";
import ContextMenuItem from "@/shared/ui/contextMenu/ContextMenuItem.vue";
import ContextMenuSeparator from "@/shared/ui/contextMenu/ContextMenuSeparator.vue";

type MessageMenuAction = "copy" | "reply" | "forward" | "select" | "recall" | "pin" | "unpin" | "bookmark" | "unbookmark" | "jump";

const props = defineProps<{
  open: boolean;
  x: number;
  y: number;
  /**
   * 菜单形态：
   * - `message`（默认）：消息本身的右键菜单；
   * - `reference`：消息引用块（回复 / 引用预览）的右键菜单，仅提供跳转动作；
   * - `forward`：转发来源块的右键菜单，仅提供「跳转到转发的原消息」动作。
   */
  mode?: "message" | "reference" | "forward";
  showRecall?: boolean;
  canPin?: boolean;
  isPinned?: boolean;
  /** 当前消息是否已收藏。 */
  isBookmarked?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "action", action: MessageMenuAction): void;
}>();

const { t } = useI18n();

/**
 * 关闭菜单（触发 `close` 事件）。
 *
 * @returns 无返回值。
 */
function handleClose(): void {
  emit("close");
}

/**
 * 派发菜单动作并关闭菜单。
 *
 * @param action - 选中的菜单动作。
 * @returns 无返回值。
 */
function handleAction(action: MessageMenuAction): void {
  emit("action", action);
  emit("close");
}
</script>

<template>
  <!-- 组件：MessageContextMenu｜职责：消息右键菜单 -->
  <ContextMenuSurface
    :open="props.open"
    :x="props.x"
    :y="props.y"
    :min-width="180"
    @close="handleClose"
  >
    <!-- 区块：引用块菜单（仅跳转到被回复 / 被转发来源消息） -->
    <template v-if="props.mode === 'reference'">
      <ContextMenuItem @select="handleAction('jump')">
        {{ t("jump_to_referenced_message") }}
      </ContextMenuItem>
    </template>
    <!-- 区块：转发来源块菜单（跨频道跳转到转发的原消息） -->
    <template v-else-if="props.mode === 'forward'">
      <ContextMenuItem @select="handleAction('jump')">
        {{ t("jump_to_forwarded_message") }}
      </ContextMenuItem>
    </template>
    <!-- 区块：消息菜单 -->
    <template v-else>
      <ContextMenuItem @select="handleAction('copy')">
        {{ t("copy_message") || t("copy") }}
      </ContextMenuItem>
      <ContextMenuItem @select="handleAction('reply')">
        {{ t("reply_message") }}
      </ContextMenuItem>
      <ContextMenuItem @select="handleAction('forward')">
        {{ t("forward_message") }}
      </ContextMenuItem>
      <ContextMenuItem @select="handleAction(props.isBookmarked ? 'unbookmark' : 'bookmark')">
        {{ props.isBookmarked ? t("remove_bookmark") : t("bookmark") }}
      </ContextMenuItem>
      <ContextMenuItem v-if="props.canPin" @select="handleAction(props.isPinned ? 'unpin' : 'pin')">
        {{ props.isPinned ? t("unpin_message") : t("pin_message") }}
      </ContextMenuItem>
      <ContextMenuItem v-if="props.showRecall" danger @select="handleAction('recall')">
        {{ t("recall_message") }}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem @select="handleAction('select')">
        {{ t("select_message") }}
      </ContextMenuItem>
    </template>
  </ContextMenuSurface>
</template>
