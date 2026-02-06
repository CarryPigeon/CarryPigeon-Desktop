/**
 * @fileoverview liveChat 的 WS 事件处理器（事件 → store 状态更新）。
 * @description chat｜展示层状态（store）：liveChatWsEventHandler。
 *
 * 说明：
 * - 该处理器只关心“事件语义”与“状态更新”，不负责 WS 连接生命周期；
 * - 通过依赖注入把 store 内部的 IO（HTTP 刷新）与状态容器（reactive/ref）解耦出来，
 *   便于后续继续拆分 liveChatStore。
 *
 * 约定：
 * - 注释中文；日志英文（由调用方的 logger 输出）。
 */

import type { Ref } from "vue";
import type { WsEventDto } from "@/features/chat/domain/types/chatWireEvents";
import type { MessageDto } from "@/features/chat/domain/types/chatWireDtos";
import type { ChatChannel, ChatMessage } from "../chatStoreTypes";

type LoggerLike = {
  debug(message: string, payload?: Record<string, unknown>): void;
};

/**
 * WS 事件处理器的依赖集合。
 */
export type LiveChatWsEventHandlerDeps = {
  /**
   * 日志端口（日志内容要求英文）。
   */
  logger: LoggerLike;
  /**
   * 当前激活 server socket（trim 后）。
   */
  getServerSocket: () => string;
  /**
   * 当前选中频道 id（trim 后）。
   */
  getCurrentChannelId: () => string;
  /**
   * 当前用户 id（用于 read_state.updated 判断“是否是我”）。
   */
  getCurrentUserId: () => string;
  /**
   * 频道列表容器（用于更新 unread）。
   */
  channelsRef: Ref<ChatChannel[]>;
  /**
   * 消息按频道存储容器。
   */
  messagesByChannel: Record<string, ChatMessage[]>;
  /**
   * 每个频道的最新读时间（ms）。
   */
  lastReadTimeMsByChannel: Record<string, number>;
  /**
   * 刷新频道列表与未读计数。
   */
  refreshChannels: () => Promise<void>;
  /**
   * 刷新某频道最新页消息（尽力而为）。
   */
  refreshChannelLatestPage: (cid: string) => Promise<void>;
  /**
   * 刷新成员侧栏（尽力而为）。
   */
  refreshMembersRail: (cid: string) => Promise<void>;
  /**
   * 派发窗口级频道变化事件（用于同步管理页等）。
   */
  dispatchChannelChanged: (cid: string, scope?: string) => void;
  /**
   * wire message → 展示层 message 的映射器。
   */
  mapWireMessage: (serverSocket: string, msg: MessageDto) => ChatMessage;
  /**
   * 消息排序比较器（用于插入后排序）。
   */
  compareMessages: (a: ChatMessage, b: ChatMessage) => number;
};

/**
 * 创建 WS 事件处理器。
 *
 * @param deps - 依赖注入。
 * @returns handleWsEvent。
 */
export function createLiveChatWsEventHandler(deps: LiveChatWsEventHandlerDeps) {
  /**
   * 处理 WS 事件（P0）。
   *
   * @param env - WS event envelope。
   * @returns void。
   */
  return function handleWsEvent(env: WsEventDto): void {
    const eventType = String(env.event_type ?? "").trim();
    const payload = env.payload as Record<string, unknown> | null;

    if (eventType === "channels.changed") {
      void deps.refreshChannels();
      return;
    }

    if (eventType === "channel.changed") {
      const cid = String(payload?.cid ?? "").trim();
      const scope = String(payload?.scope ?? "").trim();
      void deps.refreshChannels();
      if (cid) deps.dispatchChannelChanged(cid, scope);
      if (cid && cid === deps.getCurrentChannelId()) {
        // 最小对齐：根据 scope 做尽力刷新（避免过度补拉）。
        if (!scope || scope === "messages") void deps.refreshChannelLatestPage(cid);
        if (!scope || scope === "members") void deps.refreshMembersRail(cid);
      }
      return;
    }

    if (eventType === "message.created") {
      const cid = String(payload?.cid ?? "").trim();
      const msg = (payload?.message ?? null) as MessageDto | null;
      if (!cid || !msg) return;
      const mapped = deps.mapWireMessage(deps.getServerSocket(), msg);
      const list = deps.messagesByChannel[cid] ?? (deps.messagesByChannel[cid] = []);
      if (!list.some((x) => x.id === mapped.id)) {
        list.push(mapped);
        list.sort(deps.compareMessages);
      }
      const ch = deps.channelsRef.value.find((x) => x.id === cid);
      if (ch && deps.getCurrentChannelId() !== cid) ch.unread += 1;
      return;
    }

    if (eventType === "message.deleted") {
      const cid = String(payload?.cid ?? "").trim();
      const mid = String(payload?.mid ?? "").trim();
      if (!cid || !mid) return;
      const list = deps.messagesByChannel[cid] ?? [];
      const idx = list.findIndex((m) => m.id === mid);
      if (idx >= 0) list.splice(idx, 1);
      return;
    }

    if (eventType === "read_state.updated") {
      const cid = String(payload?.cid ?? "").trim();
      const uid = String(payload?.uid ?? "").trim();
      const t = Number(payload?.last_read_time ?? 0);
      if (!cid || !uid || !Number.isFinite(t)) return;
      deps.lastReadTimeMsByChannel[cid] = t;
      if (uid === deps.getCurrentUserId()) {
        const ch = deps.channelsRef.value.find((x) => x.id === cid);
        if (ch && deps.getCurrentChannelId() === cid) ch.unread = 0;
      }
      return;
    }

    deps.logger.debug("Action: ws_event_ignored", { eventType });
  };
}
