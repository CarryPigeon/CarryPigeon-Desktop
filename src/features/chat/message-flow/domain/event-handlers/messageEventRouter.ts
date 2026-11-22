/**
 * @fileoverview 消息流事件路由器（message.created / message.recalled）。
 * @description chat/message-flow｜application：消息创建/撤回事件路由器。
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
   * - 收到创建/撤回事件后，如何更新本地时间线与未读数
   */
  scope: Pick<MessageFlowScopePort, "getActiveServerSocket">;
  getScopeVersion?: () => number;
  loadMessage?: (mid: string) => Promise<ChatMessageRecord | undefined>;
  onLoadError?: (error: unknown) => void;
  timelineState: Pick<MessageTimelineStatePort, "readCurrentChannelId" | "appendMessageIfMissing" | "markMessageRecalled">;
  unreadProjection: ChannelUnreadProjectionPort;
  mapWireMessage: (serverSocket: string, msg: ChatMessageRecord) => ChatMessage;
  compareMessages: (a: ChatMessage, b: ChatMessage) => number;
  /** 新消息到来时的回调（用于桌面通知等）。 */
  onNewMessage?: (channelId: string, message: ChatMessage) => void;
};

/**
 * 创建 message-flow 事件路由器。
 *
 * 该路由器只理解消息创建/撤回事件，并把它们投影到本地时间线与未读计数。
 */
export function createMessageEventRouter(deps: MessageEventRouterDeps) {
  const inFlight = new Set<string>();
  const recalled = new Map<string, number>();
  let currentScope = "";
  function readScope(): string {
    return JSON.stringify([deps.scope.getActiveServerSocket(), deps.getScopeVersion?.()]);
  }
  function append(cid: string, msg: ChatMessageRecord, key: string): void {
    const recalledAt = recalled.get(key);
    const mapped = deps.mapWireMessage(deps.scope.getActiveServerSocket(), recalledAt ? { ...msg, recalledAt } : msg);
    const inserted = deps.timelineState.appendMessageIfMissing(cid, mapped, deps.compareMessages);
    if (!inserted || mapped.recalledAt) return;
    if (deps.timelineState.readCurrentChannelId() !== cid) deps.unreadProjection.incrementChannelUnread(cid);
    deps.onNewMessage?.(cid, mapped);
  }
  /**
   * 路由一条消息相关事件。
   *
   * 返回值语义：
   * - `true`：该事件已被 message-flow 理解或明确忽略
   * - `false`：该事件不属于 message-flow，应由其他子域继续尝试处理
   */
  return function routeMessageEvent(eventType: string, payload: Record<string, unknown> | null): boolean {
    if (eventType !== "message.created" && eventType !== "message.recalled") return false;
    const cid = String(payload?.channelId ?? "").trim();
    const msg = (payload?.message ?? null) as ChatMessageRecord | null;
    const mid = String(payload?.messageId ?? msg?.id ?? "").trim();
    if (!cid || !mid) return true;
    const scope = readScope();
    if (scope !== currentScope) {
      currentScope = scope;
      recalled.clear();
    }
    const key = JSON.stringify([scope, cid, mid]);
    if (eventType === "message.created") {
      if (msg) append(cid, msg, key);
      else if (deps.loadMessage && !inFlight.has(key) && !recalled.has(key)) {
        inFlight.add(key);
        void deps.loadMessage(mid).then((record) => {
          if (record?.id === mid && record.channelId === cid && readScope() === scope) append(cid, record, key);
        }).catch(deps.onLoadError ?? (() => undefined)).finally(() => inFlight.delete(key));
      }
      return true;
    }

    if (eventType === "message.recalled") {
      const recalledAt = Number(payload?.recalledAt) || Date.now();
      const recalledBy = String(payload?.recalledByUserId ?? "").trim();
      recalled.set(key, recalledAt);
      if (recalled.size > 1000) {
        const oldest = recalled.keys().next().value;
        if (oldest !== undefined) recalled.delete(oldest);
      }
      deps.timelineState.markMessageRecalled(cid, mid, recalledAt, recalledBy);
      // 撤回消息仍留在时间线，但应被排除在未读之外，需重算角标。
      deps.unreadProjection.recomputeChannelUnreadLocally(cid);
      return true;
    }

    return false;
  };
}
