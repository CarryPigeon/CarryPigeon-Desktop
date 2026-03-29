/**
 * @fileoverview chat WS 事件路由器（事件 -> 子域处理器）。
 * @description
 * chat 根运行时的跨子域事件集成器。
 *
 * 约束：
 * - 根层只编排事件分发；
 * - timeline/unread/read-state 的具体状态写口必须先在子域 runtime 适配成 projection port，
 *   再注入到这里，避免根层直接操作裸 Vue/ref/reactive 容器。
 */

import type { ChatMessageRecord } from "@/features/chat/domain/types/chatApiModels";
import type { ChatEventEnvelope } from "@/features/chat/domain/types/chatEventModels";
import type { ChatMessage } from "@/features/chat/message-flow/api-types";
import type {
  ChannelUnreadProjectionPort,
  MessageTimelineStatePort,
} from "@/features/chat/message-flow/application/ports";
import type { ChatChannelProjection } from "@/features/chat/presentation/events/windowMessageEvents";
import type { RoomSessionStatePort } from "@/features/chat/room-session/application/ports/sessionPorts";
import { createMessageEventRouter } from "@/features/chat/message-flow/internal";
import { createReadStateEventRouter } from "@/features/chat/room-session/internal";
import { createChatGovernanceEventRouter } from "./chatGovernanceEventRouter";

type LoggerLike = {
  debug(message: string, payload?: Record<string, unknown>): void;
};

export type ChatWsEventRouterDeps = {
  logger: LoggerLike;
  getServerSocket: () => string;
  getCurrentUserId: () => string;
  timelineState: Pick<
    MessageTimelineStatePort,
    "readCurrentChannelId" | "appendMessageIfMissing" | "removeMessage"
  >;
  unreadProjection: ChannelUnreadProjectionPort;
  readStateProjection: Pick<
    RoomSessionStatePort,
    | "readLastReadTimeMs"
    | "readLastReadMessageId"
    | "writeLastReadTimeMs"
    | "writeLastReadMessageId"
    | "markChannelReadLocally"
  >;
  refreshChannels: () => Promise<void>;
  refreshChannelLatestPage: (cid: string) => Promise<void>;
  refreshMembersRail: (cid: string) => Promise<void>;
  emitChannelProjectionChanged: (cid: string, projection?: ChatChannelProjection) => void;
  mapWireMessage: (serverSocket: string, msg: ChatMessageRecord) => ChatMessage;
  compareMessages: (a: ChatMessage, b: ChatMessage) => number;
};

export function createChatEventRouter(deps: ChatWsEventRouterDeps) {
  const routeGovernanceEvent = createChatGovernanceEventRouter({
    getCurrentChannelId: deps.timelineState.readCurrentChannelId,
    refreshChannels: deps.refreshChannels,
    refreshChannelLatestPage: deps.refreshChannelLatestPage,
    refreshMembersRail: deps.refreshMembersRail,
    emitChannelProjectionChanged: deps.emitChannelProjectionChanged,
  });

  const routeMessageEvent = createMessageEventRouter({
    scope: {
      getActiveServerSocket: deps.getServerSocket,
    },
    timelineState: deps.timelineState,
    unreadProjection: deps.unreadProjection,
    mapWireMessage: deps.mapWireMessage,
    compareMessages: deps.compareMessages,
  });

  const routeReadStateEvent = createReadStateEventRouter({
    getCurrentUserId: deps.getCurrentUserId,
    state: deps.readStateProjection,
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
