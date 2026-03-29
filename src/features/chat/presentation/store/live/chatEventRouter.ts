/**
 * @fileoverview chat WS 事件路由器（事件 -> 子域处理器）。
 * @description chat/presentation｜展示层状态（store）：chat event router。
 */

import type { Ref } from "vue";
import type { ChatMessageRecord } from "@/features/chat/domain/types/chatApiModels";
import type { ChatEventEnvelope } from "@/features/chat/domain/types/chatEventModels";
import type { ChatMessage } from "@/features/chat/message-flow/contracts";
import type { ChatChannelProjection } from "@/features/chat/presentation/events/windowMessageEvents";
import type { ChatChannel } from "@/features/chat/room-session/contracts";
import { createMessageEventRouter } from "@/features/chat/message-flow/internal";
import { createGovernanceEventRouter } from "@/features/chat/room-governance/internal";
import { createReadStateEventRouter } from "@/features/chat/room-session/internal";

type LoggerLike = {
  debug(message: string, payload?: Record<string, unknown>): void;
};

export type ChatWsEventRouterDeps = {
  logger: LoggerLike;
  getServerSocket: () => string;
  getCurrentChannelId: () => string;
  getCurrentUserId: () => string;
  channelsRef: Ref<ChatChannel[]>;
  messagesByChannel: Record<string, ChatMessage[]>;
  lastReadTimeMsByChannel: Record<string, number>;
  lastReadMidByChannel: Record<string, string>;
  refreshChannels: () => Promise<void>;
  refreshChannelLatestPage: (cid: string) => Promise<void>;
  refreshMembersRail: (cid: string) => Promise<void>;
  emitChannelProjectionChanged: (cid: string, projection?: ChatChannelProjection) => void;
  mapWireMessage: (serverSocket: string, msg: ChatMessageRecord) => ChatMessage;
  compareMessages: (a: ChatMessage, b: ChatMessage) => number;
};

export function createChatEventRouter(deps: ChatWsEventRouterDeps) {
  const routeGovernanceEvent = createGovernanceEventRouter({
    getCurrentChannelId: deps.getCurrentChannelId,
    refreshChannels: deps.refreshChannels,
    refreshChannelLatestPage: deps.refreshChannelLatestPage,
    refreshMembersRail: deps.refreshMembersRail,
    emitChannelProjectionChanged: deps.emitChannelProjectionChanged,
  });

  const routeMessageEvent = createMessageEventRouter({
    getServerSocket: deps.getServerSocket,
    getCurrentChannelId: deps.getCurrentChannelId,
    channelsRef: deps.channelsRef,
    messagesByChannel: deps.messagesByChannel,
    mapWireMessage: deps.mapWireMessage,
    compareMessages: deps.compareMessages,
  });

  const routeReadStateEvent = createReadStateEventRouter({
    getCurrentUserId: deps.getCurrentUserId,
    channelsRef: deps.channelsRef,
    lastReadTimeMsByChannel: deps.lastReadTimeMsByChannel,
    lastReadMidByChannel: deps.lastReadMidByChannel,
  });

  return function handleWsEvent(env: ChatEventEnvelope): void {
    const eventType = String(env.eventType ?? "").trim();
    const payload = env.payload && typeof env.payload === "object" ? (env.payload as Record<string, unknown>) : null;

    if (routeGovernanceEvent(eventType, payload)) return;
    if (routeMessageEvent(eventType, payload)) return;
    if (routeReadStateEvent(eventType, payload)) return;

    deps.logger.debug("Action: chat_ws_event_ignored", { eventType });
  };
}
