/**
 * @fileoverview 消息上下文菜单编排：菜单状态、动作分发、异常兜底。
 * @description chat｜presentation composable：统一消息右键/更多菜单行为。
 */

import { ref } from "vue";
import type { DeleteChatMessageOutcome, RecallChatMessageOutcome } from "@/features/chat/message-flow/api-types";
import { createAsyncTaskRunner } from "./asyncTaskRunner";

/**
 * 消息上下文菜单动作类型。
 */
export type MessageContextAction = "copy" | "reply" | "delete" | "forward" | "select" | "edit" | "recall" | "thread" | "viewThread" | "pin" | "unpin" | "bookmark" | "unbookmark";

/**
 * 消息上下文菜单编排依赖。
 */
export type UseMessageContextMenuDeps = {
  getClipboardText(messageId: string): string | null;
  copyTextToClipboard(text: string): Promise<unknown>;
  startReply(messageId: string): void;
  deleteMessage(messageId: string): Promise<DeleteChatMessageOutcome>;
  recallMessage(messageId: string): Promise<RecallChatMessageOutcome>;
  onAsyncError(action: string, error: unknown): void;
  enterMultiSelectMode(firstMessageId: string): void;
  openForwardDialog(messageId: string): void;
  startEditing(messageId: string): void;
  openThread(messageId: string): void;
  pinMessage(messageId: string): Promise<void>;
  unpinMessage(messageId: string): Promise<void>;
  bookmarkMessage(messageId: string): void;
  unbookmarkMessage(messageId: string): void;
};

/**
 * 主页面消息菜单状态与动作编排。
 */
export function useMessageContextMenu(deps: UseMessageContextMenuDeps) {
  const menuOpen = ref(false);
  const menuX = ref(0);
  const menuY = ref(0);
  const menuMessageId = ref<string>("");
  const runAsyncTask = createAsyncTaskRunner(deps.onAsyncError);

  function openMenuForMessage(e: MouseEvent, messageId: string): void {
    e.preventDefault();
    menuMessageId.value = messageId;
    menuX.value = e.clientX;
    menuY.value = e.clientY;
    menuOpen.value = true;
  }

  function closeMenu(): void {
    menuOpen.value = false;
  }

  const handleMessageContextMenu = openMenuForMessage;
  const handleMoreClick = openMenuForMessage;

  function handleMenuAction(action: MessageContextAction): void {
    const messageId = menuMessageId.value;
    if (!messageId) return;

    switch (action) {
      case "reply":
        deps.startReply(messageId);
        return;
      case "recall":
        runAsyncTask(deps.recallMessage(messageId), "chat_recall_menu_failed");
        return;
      case "delete":
        runAsyncTask(deps.deleteMessage(messageId), "chat_delete_menu_failed");
        return;
      case "select":
        deps.enterMultiSelectMode(messageId);
        return;
      case "forward": {
        deps.openForwardDialog(messageId);
        return;
      }
      case "edit": {
        deps.startEditing(messageId);
        return;
      }
      case "thread":
      case "viewThread":
        deps.openThread(messageId);
        return;
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
    menuMessageId,
    closeMenu,
    handleMenuAction,
    handleMessageContextMenu,
    handleMoreClick,
  };
}
