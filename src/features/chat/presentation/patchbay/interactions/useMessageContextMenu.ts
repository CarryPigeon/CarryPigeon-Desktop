/**
 * @fileoverview 消息上下文菜单编排：菜单状态、动作分发、异常兜底。
 * @description chat｜presentation composable：统一消息右键菜单行为。
 */

import { ref } from "vue";
import type { RecallChatMessageOutcome } from "@/features/chat/message-flow/api-types";
import { createAsyncTaskRunner } from "./asyncTaskRunner";

/**
 * 消息上下文菜单动作类型。
 *
 * 服务端目前不支持硬删除与编辑消息，因此这两个动作已移除。
 * `jump` 用于消息引用块菜单：跳转到被回复/被引用/被转发来源消息的位置。
 */
export type MessageContextAction = "copy" | "reply" | "forward" | "select" | "recall" | "pin" | "unpin" | "bookmark" | "unbookmark" | "jump";

/**
 * 消息上下文菜单形态。
 *
 * - `message`：消息本身（右键）；
 * - `reference`：消息引用块（回复 / 引用预览）；
 * - `forward`：转发来源块（跳转文案为「跳转到转发的原消息」）。
 */
export type MessageContextMenuMode = "message" | "reference" | "forward";

/**
 * 消息上下文菜单编排依赖。
 */
export type UseMessageContextMenuDeps = {
  getClipboardText(messageId: string): string | null;
  copyTextToClipboard(text: string): Promise<unknown>;
  startReply(messageId: string): void;
  recallMessage(messageId: string): Promise<RecallChatMessageOutcome>;
  onAsyncError(action: string, error: unknown): void;
  enterMultiSelectMode(firstMessageId: string): void;
  openForwardDialog(messageId: string): void;
  pinMessage(messageId: string): Promise<void>;
  unpinMessage(messageId: string): Promise<void>;
  bookmarkMessage(messageId: string): void;
  unbookmarkMessage(messageId: string): void;
  /**
   * 跳转到被回复/被引用/被转发来源消息的位置。
   *
   * channelId 存在时表示目标消息在其他频道（跨频道转发），由定位编排先切换频道。
   */
  jumpToReferencedMessage(messageId: string, channelId?: string): void;
};

/**
 * 主页面消息菜单状态与动作编排。
 */
export function useMessageContextMenu(deps: UseMessageContextMenuDeps) {
  const menuOpen = ref(false);
  const menuX = ref(0);
  const menuY = ref(0);
  const menuMessageId = ref<string>("");
  /** 菜单形态：消息本身 / 引用块 / 转发来源块。 */
  const menuMode = ref<MessageContextMenuMode>("message");
  /** 引用块菜单的目标（被回复 / 被引用 / 转发来源消息 id）。 */
  const menuReferenceMessageId = ref<string>("");
  /**
   * 引用块菜单目标的频道 id：跨频道转发来源时非空，
   * jump 动作需要它先切换频道再定位。
   */
  const menuReferenceChannelId = ref<string>("");
  const runAsyncTask = createAsyncTaskRunner(deps.onAsyncError);

  function openMenuForMessage(e: MouseEvent, messageId: string): void {
    e.preventDefault();
    menuMode.value = "message";
    menuReferenceMessageId.value = "";
    menuReferenceChannelId.value = "";
    menuMessageId.value = messageId;
    menuX.value = e.clientX;
    menuY.value = e.clientY;
    menuOpen.value = true;
  }

  /**
   * 在消息引用块（回复 / 引用预览 / 转发来源）上打开右键菜单。
   *
   * 说明：channelId 存在时视为转发来源块（跨频道跳转目标），
   * 菜单形态切为 `forward`（文案为「跳转到转发的原消息」）；
   * 回复 / 内联引用的目标恒在当前频道，不携带 channelId。
   *
   * @param e - 鼠标右键事件。
   * @param referencedMessageId - 被引用的消息 id。
   * @param channelId - 跳转目标所在频道（跨频道转发来源时提供）。
   * @returns 无返回值。
   */
  function openMenuForReference(e: MouseEvent, referencedMessageId: string, channelId?: string): void {
    const mid = String(referencedMessageId ?? "").trim();
    if (!mid) return;
    e.preventDefault();
    const cid = String(channelId ?? "").trim();
    menuMode.value = cid ? "forward" : "reference";
    menuReferenceMessageId.value = mid;
    menuReferenceChannelId.value = cid;
    menuMessageId.value = "";
    menuX.value = e.clientX;
    menuY.value = e.clientY;
    menuOpen.value = true;
  }

  function closeMenu(): void {
    menuOpen.value = false;
  }

  const handleMessageContextMenu = openMenuForMessage;
  const handleReferenceContextMenu = openMenuForReference;

  function handleMenuAction(action: MessageContextAction): void {
    if (action === "jump") {
      const referencedId = menuReferenceMessageId.value;
      if (!referencedId) return;
      deps.jumpToReferencedMessage(referencedId, menuReferenceChannelId.value || undefined);
      return;
    }

    const messageId = menuMessageId.value;
    if (!messageId) return;

    switch (action) {
      case "reply":
        deps.startReply(messageId);
        return;
      case "recall":
        runAsyncTask(deps.recallMessage(messageId), "chat_recall_menu_failed");
        return;
      case "select":
        deps.enterMultiSelectMode(messageId);
        return;
      case "forward": {
        deps.openForwardDialog(messageId);
        return;
      }
      case "copy": {
        const text = deps.getClipboardText(messageId);
        if (!text) return;
        runAsyncTask(deps.copyTextToClipboard(text), "chat_copy_message_failed");
        return;
      }
      case "pin":
        runAsyncTask(deps.pinMessage(messageId), "chat_pin_message_failed");
        return;
      case "unpin":
        runAsyncTask(deps.unpinMessage(messageId), "chat_unpin_message_failed");
        return;
      case "bookmark":
        deps.bookmarkMessage(messageId);
        return;
      case "unbookmark":
        deps.unbookmarkMessage(messageId);
        return;
    }
  }

  return {
    menuOpen,
    menuX,
    menuY,
    menuMode,
    menuMessageId,
    menuReferenceMessageId,
    menuReferenceChannelId,
    closeMenu,
    handleMenuAction,
    handleMessageContextMenu,
    handleReferenceContextMenu,
  };
}
