/**
 * @fileoverview 消息流用户动作（删除消息）。
 * @description chat/message-flow｜application：消息删除动作编排。
 *
 * 职责：
 * - 提供消息维度的用户动作：按消息 id 删除消息。
 * - 内聚“本地乐观更新 + 失败回滚”的交互语义，避免主 store 充斥细节。
 */

import type {
  DeleteChatMessageOutcome,
} from "@/features/chat/message-flow/domain/contracts";
import { createMessageActionError, rejectMessageAction } from "../outcomes/messageActionOutcome";
import type {
  MessageComposerStatePort,
  MessageFlowApiPort,
  MessageFlowScopePort,
  MessageTimelineStatePort,
} from "../ports";

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
  scope: MessageFlowScopePort;
  timelineState: MessageTimelineStatePort;
  composerState: MessageComposerStatePort;
};

/**
 * 创建消息动作集合。
 *
 * @param deps - 依赖集合。
 * @returns `{ deleteMessage }`。
 */
export function createMessageActions(deps: MessageActionsDeps) {
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
      const error = createMessageActionError("missing_message_id", "Missing message id.");
      deps.composerState.writeActionError(error);
      return rejectMessageAction("chat_message_delete_rejected", "missing_message_id", "Missing message id.");
    }
    const [socket, token] = await deps.scope.getSocketAndValidToken();
    if (!socket || !token) {
      const error = createMessageActionError("not_signed_in", "Not signed in.");
      deps.composerState.writeActionError(error);
      return rejectMessageAction("chat_message_delete_rejected", "not_signed_in", "Not signed in.");
    }
    const requestSocket = socket;
    const requestScopeVersion = deps.scope.getActiveScopeVersion();

    const cid = deps.timelineState.readCurrentChannelId();
    const removal = deps.timelineState.beginOptimisticMessageRemoval(cid, mid);

    try {
      await deps.api.deleteMessage(socket, token, mid);
      if (deps.scope.getActiveServerSocket() !== requestSocket || deps.scope.getActiveScopeVersion() !== requestScopeVersion) {
        return {
          ok: true,
          kind: "chat_message_deleted",
          messageId: mid,
        };
      }
      deps.composerState.writeActionError(null);
      return {
        ok: true,
        kind: "chat_message_deleted",
        messageId: mid,
      };
    } catch (e) {
      if (deps.scope.getActiveServerSocket() !== requestSocket || deps.scope.getActiveScopeVersion() !== requestScopeVersion) {
        return rejectMessageAction(
          "chat_message_delete_rejected",
          "stale_runtime_scope",
          "Chat runtime changed before the delete result could be applied.",
          undefined,
          { requestSocket, messageId: mid },
        );
      }
      removal.restore();
      const error = createMessageActionError("delete_failed", "Delete failed.", e, { messageId: mid, channelId: cid });
      deps.composerState.writeActionError(error);
      return {
        ok: false,
        kind: "chat_message_delete_rejected",
        error,
      };
    }
  }

  return { deleteMessage };
}
