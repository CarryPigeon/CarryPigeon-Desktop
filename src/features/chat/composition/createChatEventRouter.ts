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
} from "@/features/chat/message-flow/domain/ports";
import type { ChatChannelProjection } from "@/features/chat/presentation/shared/windowMessageEvents";
import type { RoomSessionStatePort } from "@/features/chat/room-session/domain/ports";
import { createMessageEventRouter } from "@/features/chat/message-flow/internal";
import { createReadStateEventRouter } from "@/features/chat/room-session/internal";
import { createChatGovernanceEventRouter } from "./createChatGovernanceEventRouter";
import { createNotificationOnNewMessageHandler } from "@/app/bootstrap/trayIntegration";
import { invokeTauri } from "@/shared/tauri/invokeClient";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";

type LoggerLike = {
  debug(message: string, payload?: Record<string, unknown>): void;
};

/**
 * chat 根 WS 事件路由器依赖。
 */
export type ChatWsEventRouterDeps = {
  logger: LoggerLike;
  getServerSocket: () => string;
  getCurrentUserId: () => string;
  timelineState: Pick<
    MessageTimelineStatePort,
    "readCurrentChannelId" | "appendMessageIfMissing" | "removeMessage" | "updateMessageReactions" | "updateMessage" | "markMessageRecalled"
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

/**
 * 创建 chat 根 WS 事件路由器。
 */
export function createChatEventRouter(deps: ChatWsEventRouterDeps) {
  const routeGovernanceEvent = createChatGovernanceEventRouter({
    getCurrentChannelId: deps.timelineState.readCurrentChannelId,
    refreshChannels: deps.refreshChannels,
    refreshChannelLatestPage: deps.refreshChannelLatestPage,
    refreshMembersRail: deps.refreshMembersRail,
    emitChannelProjectionChanged: deps.emitChannelProjectionChanged,
  });

  const handleNewMessage = createNotificationOnNewMessageHandler({
    getGlobalDndEnabled: () =>
      invokeTauri<boolean>(TAURI_COMMANDS.settingsGetConfigBool, { key: "global_dnd" }),
    getDesktopNotificationsEnabled: () =>
      invokeTauri<boolean>(TAURI_COMMANDS.settingsGetConfigBool, { key: "desktop_notifications" }),
    getCurrentChannelId: deps.timelineState.readCurrentChannelId,
    getCurrentUserId: deps.getCurrentUserId,
    getChannelNotificationPreference: async () => "all",
    getChannelName: (cid) => cid,
  });

  const routeMessageEvent = createMessageEventRouter({
    scope: {
      getActiveServerSocket: deps.getServerSocket,
    },
    timelineState: deps.timelineState,
    unreadProjection: deps.unreadProjection,
    mapWireMessage: deps.mapWireMessage,
    compareMessages: deps.compareMessages,
    onNewMessage: handleNewMessage,
  });

  const routeReadStateEvent = createReadStateEventRouter({
    getCurrentUserId: deps.getCurrentUserId,
    state: deps.readStateProjection,
  });

  /**
   * mention 触发的频道最新页补拉：按 cid 去重并发中的补拉，
   * 避免短时间多条提及造成重复请求（不依赖调用方是否已包一层 dedupe）。
   */
  const mentionRefreshInFlight = new Map<string, Promise<void>>();

  return function handleWsEvent(env: ChatEventEnvelope): void {
    const eventType = String(env.eventType ?? "").trim();
    const payload = env.payload && typeof env.payload === "object" ? (env.payload as Record<string, unknown>) : null;

    if (routeGovernanceEvent(eventType, payload)) return;
    if (routeMessageEvent(eventType, payload)) return;

    // 服务端 realtime 会按通知偏好过滤 mentions_only/muted 频道的 message.created，
    // 但 mention.created 始终可达 —— 用它作为该类频道时间线的即时补拉信号。
    if (eventType === "mention.created") {
      const cid = String(payload?.channelId ?? "").trim();
      if (cid && !mentionRefreshInFlight.has(cid)) {
        const pending = Promise.resolve()
          .then(() => deps.refreshChannelLatestPage(cid))
          .finally(() => {
            if (mentionRefreshInFlight.get(cid) === pending) mentionRefreshInFlight.delete(cid);
          });
        mentionRefreshInFlight.set(cid, pending);
      }
      return;
    }

    if (routeReadStateEvent(eventType, payload)) return;

    deps.logger.debug("Action: chat_ws_event_ignored", { eventType });
  };
}
