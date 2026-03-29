/**
 * @fileoverview 消息流用户动作（删除消息）。
 * @description chat/message-flow｜application：消息删除动作编排。
 *
 * 职责：
 * - 提供消息维度的用户动作：按消息 id 删除消息。
 * - 内聚“本地乐观更新 + 失败回滚”的交互语义，避免主 store 充斥细节。
 */

import type { Ref } from "vue";
import type {
  ChatMessage,
  ChatMessageActionErrorInfo,
  DeleteChatMessageOutcome,
} from "@/features/chat/message-flow/contracts";
import type { MessageFlowApiPort } from "./ports";

/**
 * 消息动作依赖集合。
 */
export type MessageActionsDeps = {
  /**
   * chat API 端口。
   */
  api: MessageFlowApiPort;
  /**
   * 获取当前 server socket 与可用 access token（均已 trim）。
   */
  getSocketAndValidToken: () => Promise<[string, string]>;
  /**
   * 获取当前激活 server socket（trim 后）。
   */
  getActiveServerSocket: () => string;
  /**
   * 获取当前 server-scope 版本号。
   */
  getActiveScopeVersion: () => number;
  /**
   * 当前频道 id（用于定位消息容器）。
   */
  currentChannelId: Ref<string>;
  /**
   * channelId → message list（用于乐观删除与回滚）。
   */
  messagesByChannel: Record<string, ChatMessage[]>;
  /**
   * UI 错误提示（删除失败时写入）。
   */
  messageActionError: Ref<ChatMessageActionErrorInfo | null>;
};

/**
 * 创建消息动作集合。
 *
 * @param deps - 依赖集合。
 * @returns `{ deleteMessage }`。
 */
export function createMessageActions(deps: MessageActionsDeps) {
  function createDeleteError(message: string): ChatMessageActionErrorInfo {
    return {
      code: "delete_failed",
      message,
      retryable: true,
    };
  }

  /**
   * 按消息 id 硬删除消息（hard-delete）。
   *
   * 策略：
   * - 先本地移除（乐观更新），再请求服务端删除；
   * - 若服务端删除失败，则回滚本地移除并写入 `messageActionError`。
   *
   * @param messageId - 消息 id（mid）。
   * @returns Promise<void>。
   */
  async function deleteMessage(messageId: string): Promise<DeleteChatMessageOutcome> {
    const mid = String(messageId).trim();
    if (!mid) {
      const error = createDeleteError("Missing message id.");
      deps.messageActionError.value = error;
      return {
        ok: false,
        kind: "chat_message_delete_rejected",
        error,
      };
    }
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) {
      const error = {
        code: "not_signed_in" as const,
        message: "Not signed in.",
        retryable: false,
      };
      deps.messageActionError.value = error;
      return {
        ok: false,
        kind: "chat_message_delete_rejected",
        error,
      };
    }
    const requestSocket = socket;
    const requestScopeVersion = deps.getActiveScopeVersion();

    const cid = deps.currentChannelId.value;
    const list = deps.messagesByChannel[cid] ?? [];
    const idx = list.findIndex((m) => m.id === mid);
    const removed = idx >= 0 ? list.splice(idx, 1)[0] : null;

    try {
      await deps.api.deleteMessage(socket, token, mid);
      if (deps.getActiveServerSocket() !== requestSocket || deps.getActiveScopeVersion() !== requestScopeVersion) {
        return {
          ok: true,
          kind: "chat_message_deleted",
          messageId: mid,
        };
      }
      deps.messageActionError.value = null;
      return {
        ok: true,
        kind: "chat_message_deleted",
        messageId: mid,
      };
    } catch (e) {
      if (deps.getActiveServerSocket() !== requestSocket || deps.getActiveScopeVersion() !== requestScopeVersion) {
        return {
          ok: false,
          kind: "chat_message_delete_rejected",
          error: createDeleteError("Delete failed."),
        };
      }
      if (removed && idx >= 0) list.splice(idx, 0, removed);
      const error = createDeleteError(`Delete failed: ${String(e)}`);
      deps.messageActionError.value = error;
      return {
        ok: false,
        kind: "chat_message_delete_rejected",
        error,
      };
    }
  }

  return { deleteMessage };
}
