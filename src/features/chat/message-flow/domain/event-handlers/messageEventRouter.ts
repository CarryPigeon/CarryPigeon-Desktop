/**
 * @fileoverview 消息流事件路由器（message.created / message.deleted）。
 * @description chat/message-flow｜application：消息创建/删除事件路由器。
 */

import type { ChatMessageRecord } from "@/features/chat/domain/types/chatApiModels";
import type { ChatMessage } from "@/features/chat/message-flow/domain/contracts";
import type { MessageReactionSummary } from "@/features/chat/message-flow/domain/contracts";
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
  timelineState: Pick<MessageTimelineStatePort, "readCurrentChannelId" | "appendMessageIfMissing" | "removeMessage" | "updateMessageReactions" | "updateMessage" | "markMessageRecalled">;
  unreadProjection: ChannelUnreadProjectionPort;
  mapWireMessage: (serverSocket: string, msg: ChatMessageRecord) => ChatMessage;
  compareMessages: (a: ChatMessage, b: ChatMessage) => number;
  /** 新消息到来时的回调（用于桌面通知等）。 */
  onNewMessage?: (channelId: string, message: ChatMessage) => void;
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
      deps.onNewMessage?.(cid, mapped);
      return true;
    }

    if (eventType === "message.deleted") {
      const cid = String(payload?.channelId ?? "").trim();
      const mid = String(payload?.messageId ?? "").trim();
      if (!cid || !mid) return true;

      deps.timelineState.removeMessage(cid, mid);
      // 本地时间线移除后，以可见消息重算角标（服务端仍会把已删消息计入未读）。
      deps.unreadProjection.recomputeChannelUnreadLocally(cid);
      return true;
    }

    if (eventType === "message.reactions_updated") {
      const cid = String(payload?.channelId ?? "").trim();
      const mid = String(payload?.messageId ?? "").trim();
      const reactions = (payload?.reactions ?? []) as MessageReactionSummary[];
      if (!cid || !mid) return true;

      deps.timelineState.updateMessageReactions(cid, mid, reactions);
      return true;
    }

    if (eventType === "message.updated") {
      const cid = String(payload?.channelId ?? "").trim();
      const msg = (payload?.message ?? null) as ChatMessageRecord | null;
      if (!cid || !msg) return true;

      const mapped = deps.mapWireMessage(deps.scope.getActiveServerSocket(), msg);
      deps.timelineState.updateMessage(cid, mapped.id, () => mapped);
      return true;
    }

    if (eventType === "message.recalled") {
      const cid = String(payload?.channelId ?? "").trim();
      const mid = String(payload?.messageId ?? "").trim();
      const recalledAt = Number(payload?.recalledAt ?? 0);
      const recalledBy = String(payload?.recalledByUserId ?? "").trim();
      if (!cid || !mid) return true;

      deps.timelineState.markMessageRecalled(cid, mid, recalledAt, recalledBy);
      // 撤回消息仍留在时间线，但应被排除在未读之外，需重算角标。
      deps.unreadProjection.recomputeChannelUnreadLocally(cid);
      return true;
    }

    return false;
  };
}
