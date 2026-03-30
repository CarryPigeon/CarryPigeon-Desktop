/**
 * @fileoverview 消息流事件路由器（message.created / message.deleted）。
 * @description chat/message-flow｜application：消息创建/删除事件路由器。
 */

import type { ChatMessageRecord } from "@/features/chat/domain/types/chatApiModels";
import type { ChatMessage } from "@/features/chat/message-flow/domain/contracts";
import type {
  ChannelUnreadProjectionPort,
  MessageFlowScopePort,
  MessageTimelineStatePort,
} from "../ports";

/**
 * message-flow 事件路由器依赖。
 */
export type MessageEventRouterDeps = {
  /**
   * 事件路由器只关心两类事实：
   * - 当前 socket / 当前频道是谁
   * - 收到创建/删除事件后，如何更新本地时间线与未读数
   */
  scope: Pick<MessageFlowScopePort, "getActiveServerSocket">;
  timelineState: Pick<MessageTimelineStatePort, "readCurrentChannelId" | "appendMessageIfMissing" | "removeMessage">;
  unreadProjection: ChannelUnreadProjectionPort;
  mapWireMessage: (serverSocket: string, msg: ChatMessageRecord) => ChatMessage;
  compareMessages: (a: ChatMessage, b: ChatMessage) => number;
};

/**
 * 创建 message-flow 事件路由器。
 *
 * 该路由器只理解消息创建/删除事件，并把它们投影到本地时间线与未读计数。
 */
export function createMessageEventRouter(deps: MessageEventRouterDeps) {
  /**
   * 路由一条消息相关事件。
   *
   * 返回值语义：
   * - `true`：该事件已被 message-flow 理解或明确忽略
   * - `false`：该事件不属于 message-flow，应由其他子域继续尝试处理
   */
  return function routeMessageEvent(eventType: string, payload: Record<string, unknown> | null): boolean {
    if (eventType === "message.created") {
      const cid = String(payload?.channelId ?? "").trim();
      const msg = (payload?.message ?? null) as ChatMessageRecord | null;
      if (!cid || !msg) return true;

      const mapped = deps.mapWireMessage(deps.scope.getActiveServerSocket(), msg);
      const inserted = deps.timelineState.appendMessageIfMissing(cid, mapped, deps.compareMessages);
      if (inserted && deps.timelineState.readCurrentChannelId() !== cid) deps.unreadProjection.incrementChannelUnread(cid);
      return true;
    }

    if (eventType === "message.deleted") {
      const cid = String(payload?.channelId ?? "").trim();
      const mid = String(payload?.messageId ?? "").trim();
      if (!cid || !mid) return true;

      deps.timelineState.removeMessage(cid, mid);
      return true;
    }

    return false;
  };
}
