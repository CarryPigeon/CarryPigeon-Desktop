/**
 * @fileoverview 消息流事件路由器（message.created / message.deleted）。
 * @description chat/message-flow｜application：消息创建/删除事件路由器。
 */

import type { Ref } from "vue";
import type { ChatMessageRecord } from "@/features/chat/domain/types/chatApiModels";
import type { ChatMessage } from "@/features/chat/message-flow/contracts";
import type { ChatChannel } from "@/features/chat/room-session/contracts";

export type MessageEventRouterDeps = {
  getServerSocket: () => string;
  getCurrentChannelId: () => string;
  channelsRef: Ref<ChatChannel[]>;
  messagesByChannel: Record<string, ChatMessage[]>;
  mapWireMessage: (serverSocket: string, msg: ChatMessageRecord) => ChatMessage;
  compareMessages: (a: ChatMessage, b: ChatMessage) => number;
};

export function createMessageEventRouter(deps: MessageEventRouterDeps) {
  return function routeMessageEvent(eventType: string, payload: Record<string, unknown> | null): boolean {
    if (eventType === "message.created") {
      const cid = String(payload?.channelId ?? "").trim();
      const msg = (payload?.message ?? null) as ChatMessageRecord | null;
      if (!cid || !msg) return true;

      const mapped = deps.mapWireMessage(deps.getServerSocket(), msg);
      const list = deps.messagesByChannel[cid] ?? (deps.messagesByChannel[cid] = []);
      const inserted = !list.some((x) => x.id === mapped.id);
      if (inserted) {
        list.push(mapped);
        list.sort(deps.compareMessages);
        const ch = deps.channelsRef.value.find((x) => x.id === cid);
        if (ch && deps.getCurrentChannelId() !== cid) ch.unread += 1;
      }
      return true;
    }

    if (eventType === "message.deleted") {
      const cid = String(payload?.channelId ?? "").trim();
      const mid = String(payload?.messageId ?? "").trim();
      if (!cid || !mid) return true;

      const list = deps.messagesByChannel[cid] ?? [];
      const idx = list.findIndex((m) => m.id === mid);
      if (idx >= 0) list.splice(idx, 1);
      return true;
    }

    return false;
  };
}
