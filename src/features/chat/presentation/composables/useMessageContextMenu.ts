/**
 * @fileoverview 消息上下文菜单编排：菜单状态、动作分发、异常兜底。
 * @description chat｜presentation composable：统一消息右键/更多菜单行为。
 */

import { ref } from "vue";
import type { DeleteChatMessageOutcome } from "@/features/chat/message-flow/api-types";
import { createAsyncTaskRunner } from "./asyncTaskRunner";

export type MessageContextAction = "copy" | "reply" | "delete" | "forward";

export type UseMessageContextMenuDeps = {
  getClipboardText(messageId: string): string | null;
  copyTextToClipboard(text: string): Promise<unknown>;
  startReply(messageId: string): void;
  deleteMessage(messageId: string): Promise<DeleteChatMessageOutcome>;
  onAsyncError(action: string, error: unknown): void;
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
      case "delete":
        runAsyncTask(deps.deleteMessage(messageId), "chat_delete_menu_failed");
        return;
      case "forward":
      case "copy": {
        // 当前阶段 forward 复用 copy 行为，后续可在此分叉到独立转发流程。
        const text = deps.getClipboardText(messageId);
        if (!text) return;
        runAsyncTask(deps.copyTextToClipboard(text), "chat_copy_message_failed");
        return;
      }
    }
  }

  return {
    menuOpen,
    menuX,
    menuY,
    closeMenu,
    handleMenuAction,
    handleMessageContextMenu,
    handleMoreClick,
  };
}
