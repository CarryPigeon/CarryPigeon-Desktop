/**
 * @fileoverview chat 会话连接生命周期运行时。
 * @description
 * 专注负责 room-session 中与“连接链路”直接相关的编排：
 * - ensureChatReady；
 * - WS 连接与事件路由；
 * - polling fallback；
 * - resume failed catch-up；
 * - 自动刷新与 session 监听的绑定/释放。
 *
 * 读取方式：
 * - 可以把它看成 session runtime 的“连接子系统”；
 * - 外层 session 公开 store 不需要知道 wsManager/polling/hooks 的具体组合细节。
 */

import { onAuthSessionChanged, startAuthSessionAutoRefresh } from "@/shared/net/auth/api";
import { toHttpOrigin } from "@/shared/net/http/serverOrigin";
import { emitChannelProjectionChanged } from "@/features/chat/presentation/events/windowMessageEvents";
import {
  createEnsureReady,
  createPollingFallback,
  createResumeFailedCatchUp,
  createSessionWsManager,
} from "@/features/chat/room-session/internal";
import { getCurrentChatUserId } from "@/features/chat/integration/accountSession";
import { getChatTlsPolicy, getChatWsUrlOverride } from "@/features/chat/integration/serverWorkspace";
import type { ChatEventsGateway } from "./chatGateway";
import { createChatEventRouter } from "./chatEventRouter";
import type { ChatRuntimeScopePort } from "./chatScopePort";
import type { ChatGovernanceRuntimePort } from "./chatGovernanceRuntimePorts";
import type { ChatMessageFlowRuntimePort } from "./chatMessageFlowRuntimePorts";
import type {
  ChatSessionConnectionRuntimePort,
  ChatSessionStateSlice,
} from "./chatSessionRuntimePorts";

type LoggerLike = {
  debug(message: string, payload?: Record<string, unknown>): void;
  info(message: string, payload?: Record<string, unknown>): void;
  warn(message: string, payload?: Record<string, unknown>): void;
};

export type ChatSessionConnectionRuntimeDeps = {
  events: ChatEventsGateway;
  logger: LoggerLike;
  channelsRef: ChatSessionStateSlice["channelsRef"];
  currentChannelId: ChatSessionStateSlice["currentChannelId"];
  messagesByChannel: ChatSessionStateSlice["messagesByChannel"];
  lastReadTimeMsByChannel: ChatSessionStateSlice["lastReadTimeMsByChannel"];
  lastReadMidByChannel: ChatSessionStateSlice["lastReadMidByChannel"];
  governance: ChatGovernanceRuntimePort;
  messageFlow: ChatMessageFlowRuntimePort;
  scope: ChatRuntimeScopePort;
};

const POLL_INTERVAL_MS = 8000;
const CATCH_UP_PREFETCH_LIMIT = 5;

export function createChatSessionConnectionRuntime(
  deps: ChatSessionConnectionRuntimeDeps,
): ChatSessionConnectionRuntimePort {
  const {
    events,
    logger,
    channelsRef,
    currentChannelId,
    messagesByChannel,
    lastReadTimeMsByChannel,
    lastReadMidByChannel,
    governance,
    messageFlow,
    scope,
  } = deps;

  const wsManager = createSessionWsManager(events);
  let stopAutoRefresh: (() => void) | null = null;
  let stopSessionListener: (() => void) | null = null;

  const polling = createPollingFallback({
    intervalMs: POLL_INTERVAL_MS,
    getActiveServerSocket: scope.getActiveServerSocket,
    getActiveScopeVersion: scope.getActiveScopeVersion,
    getCurrentChannelId: () => currentChannelId.value.trim(),
    refreshChannels: governance.refreshChannels,
    refreshChannelLatestPage: messageFlow.refreshChannelLatestPage,
  });

  function teardownConnectionLifecycle(): void {
    wsManager.close();
    polling.stop();
    stopAutoRefresh?.();
    stopSessionListener?.();
    stopAutoRefresh = null;
    stopSessionListener = null;
  }

  const handleWsEvent = createChatEventRouter({
    logger,
    getServerSocket: scope.getActiveServerSocket,
    getCurrentChannelId: () => currentChannelId.value.trim(),
    getCurrentUserId: getCurrentChatUserId,
    channelsRef,
    messagesByChannel,
    lastReadTimeMsByChannel,
    lastReadMidByChannel,
    refreshChannels: governance.refreshChannels,
    refreshChannelLatestPage: messageFlow.refreshChannelLatestPage,
    refreshMembersRail: governance.refreshMembersRail,
    emitChannelProjectionChanged,
    mapWireMessage: messageFlow.mapWireMessage,
    compareMessages: messageFlow.compareMessages,
  });

  const catchUpAfterResumeFailed = createResumeFailedCatchUp({
    logger,
    getActiveServerSocket: scope.getActiveServerSocket,
    getActiveScopeVersion: scope.getActiveScopeVersion,
    getCurrentChannelId: () => currentChannelId.value.trim(),
    listChannels: () => channelsRef.value,
    refreshChannels: governance.refreshChannels,
    refreshChannelLatestPage: messageFlow.refreshChannelLatestPage,
    refreshMembersRail: governance.refreshMembersRail,
    prefetchLimit: CATCH_UP_PREFETCH_LIMIT,
  });

  const ensureChatReady = createEnsureReady({
    logger,
    getSocketAndValidToken: scope.getSocketAndValidToken,
    getActiveServerSocket: scope.getActiveServerSocket,
    getActiveScopeVersion: scope.getActiveScopeVersion,
    refreshChannels: governance.refreshChannels,
    loadChannelMessages: messageFlow.loadChannelMessages,
    refreshMembersRail: governance.refreshMembersRail,
    getCurrentChannelId: () => currentChannelId.value.trim(),
    setCurrentChannelIdIfEmpty: () => {
      if (!currentChannelId.value) currentChannelId.value = channelsRef.value[0]?.id ?? "";
    },
    getTlsPolicyForSocket: getChatTlsPolicy,
    toHttpOrigin,
    getWsUrlOverride: getChatWsUrlOverride,
    wsManager,
    polling,
    stopPolling: () => {
      polling.stop();
    },
    startAutoRefresh: startAuthSessionAutoRefresh,
    onAuthSessionChanged,
    getStopAutoRefresh: () => stopAutoRefresh,
    setStopAutoRefresh: (stopper) => {
      stopAutoRefresh = stopper;
    },
    getStopSessionListener: () => stopSessionListener,
    setStopSessionListener: (stopper) => {
      stopSessionListener = stopper;
    },
    onWsEvent: handleWsEvent,
    onResumeFailed: (socketKey, reason) => {
      void catchUpAfterResumeFailed(socketKey, reason);
    },
  });

  return {
    ensureChatReady,
    teardownConnectionLifecycle,
  };
}
