/**
 * @fileoverview chat 会话运行时装配。
 * @description
 * 聚合 room-session 对外公开的会话能力：
 * - 连接生命周期运行时；
 * - 频道视图动作；
 * - 切服后的状态重置。
 *
 * 读取方式：
 * - 可以把它视为 chat 的“会话协调器”；
 * - 它只负责组合各类 session 子能力，不再直接承载 WS/polling/catch-up 的实现细节。
 */

import type { ChatReadStateReporterPort } from "@/features/chat/application/ports/runtimePorts";
import {
  createChannelViewActions,
  resetRoomSessionState,
} from "@/features/chat/room-session/internal";
import type { ChatEventsGateway } from "./chatGateway";
import type { ChatRuntimeScopePort } from "./chatScopePort";
import type { ChatGovernanceRuntimePort } from "./chatGovernanceRuntimePorts";
import type { ChatMessageFlowRuntimePort } from "./chatMessageFlowRuntimePorts";
import type { ChatSessionRuntimePort, ChatSessionStateSlice } from "./chatSessionRuntimePorts";
import { createChatSessionConnectionRuntime } from "./chatSessionConnectionRuntime";

type LoggerLike = {
  debug(message: string, payload?: Record<string, unknown>): void;
  info(message: string, payload?: Record<string, unknown>): void;
  warn(message: string, payload?: Record<string, unknown>): void;
};

export type ChatSessionRuntimeDeps = {
  events: ChatEventsGateway;
  logger: LoggerLike;
  channelsRef: ChatSessionStateSlice["channelsRef"];
  currentChannelId: ChatSessionStateSlice["currentChannelId"];
  members: ChatSessionStateSlice["members"];
  messagesByChannel: ChatSessionStateSlice["messagesByChannel"];
  lastReadTimeMsByChannel: ChatSessionStateSlice["lastReadTimeMsByChannel"];
  lastReadMidByChannel: ChatSessionStateSlice["lastReadMidByChannel"];
  lastReadReportAtMsByChannel: ChatSessionStateSlice["lastReadReportAtMsByChannel"];
  nextCursorByChannel: ChatSessionStateSlice["nextCursorByChannel"];
  hasMoreByChannel: ChatSessionStateSlice["hasMoreByChannel"];
  loadingMoreByChannel: ChatSessionStateSlice["loadingMoreByChannel"];
  scopeVersion: ChatSessionStateSlice["scopeVersion"];
  messageActionError: ChatSessionStateSlice["messageActionError"];
  composerDraft: ChatSessionStateSlice["composerDraft"];
  replyToMessageId: ChatSessionStateSlice["replyToMessageId"];
  selectedDomainId: ChatSessionStateSlice["selectedDomainId"];
  governance: ChatGovernanceRuntimePort;
  messageFlow: ChatMessageFlowRuntimePort;
  scope: ChatRuntimeScopePort;
  readStateReporter: ChatReadStateReporterPort;
};

/**
 * 创建 session 运行时。
 *
 * 设计原因：
 * - 连接生命周期与频道视图动作都属于 room-session；
 * - 但它们的变化频率不同，因此拆成独立子模块后再由这里聚合导出。
 */
export function createChatSessionRuntime(deps: ChatSessionRuntimeDeps): ChatSessionRuntimePort {
  const {
    events,
    logger,
    channelsRef,
    currentChannelId,
    members,
    messagesByChannel,
    lastReadTimeMsByChannel,
    lastReadMidByChannel,
    lastReadReportAtMsByChannel,
    nextCursorByChannel,
    hasMoreByChannel,
    loadingMoreByChannel,
    scopeVersion,
    messageActionError,
    composerDraft,
    replyToMessageId,
    selectedDomainId,
    governance,
    messageFlow,
    scope,
    readStateReporter,
  } = deps;
  const connectionRuntime = createChatSessionConnectionRuntime({
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
  });

  const channelViewActions = createChannelViewActions({
    channelsRef,
    currentChannelId,
    messagesByChannel,
    lastReadTimeMsByChannel,
    lastReadMidByChannel,
    lastReadReportAtMsByChannel,
    loadChannelMessages: messageFlow.loadChannelMessages,
    refreshMembersRail: governance.refreshMembersRail,
    readStateReporter,
  });

  function resetForServerChange(): void {
    resetRoomSessionState({
      teardownConnectionLifecycle: connectionRuntime.teardownConnectionLifecycle,
      channelsRef,
      members,
      currentChannelId,
      messagesByChannel,
      lastReadTimeMsByChannel,
      lastReadMidByChannel,
      lastReadReportAtMsByChannel,
      nextCursorByChannel,
      hasMoreByChannel,
      loadingMoreByChannel,
      scopeVersion,
      messageActionError,
      composerDraft,
      replyToMessageId,
      selectedDomainId,
    });
  }

  return {
    ensureChatReady: connectionRuntime.ensureChatReady,
    resetForServerChange,
    ...channelViewActions,
  };
}
