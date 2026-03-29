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
import type { ChatEventEnvelope } from "@/features/chat/domain/types/chatEventModels";
import {
  createChannelViewActions,
  resetRoomSessionState,
} from "@/features/chat/room-session/internal";
import type { ChatEventsGateway } from "@/features/chat/presentation/store/live/chatGateway";
import type { ChatRuntimeScopePort } from "@/features/chat/presentation/store/live/chatScopePort";
import type { ChatMessageFlowRuntimePort } from "@/features/chat/message-flow/presentation/runtime/messageFlowRuntimePorts";
import type { ChatGovernanceRuntimePort } from "@/features/chat/room-governance/presentation/runtime/governanceRuntimePorts";
import { createChatSessionConnectionRuntime } from "./sessionConnectionRuntime";
import type { ChatSessionRuntimePort, ChatSessionStateSlice } from "./sessionRuntimePorts";
import { createRoomSessionStatePort } from "./sessionStatePorts";

type LoggerLike = {
  debug(message: string, payload?: Record<string, unknown>): void;
  info(message: string, payload?: Record<string, unknown>): void;
  warn(message: string, payload?: Record<string, unknown>): void;
};

export type ChatSessionRuntimeDeps = {
  /**
   * 该依赖集合对应 room-session 需要的三类东西：
   * - 原始状态切片
   * - 其他子运行时暴露的窄能力
   * - 连接/作用域基础设施
   */
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
  onWsEvent: (env: ChatEventEnvelope) => void;
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
    onWsEvent,
  } = deps;
  const sessionState = createRoomSessionStatePort({
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
  });
  const connectionRuntime = createChatSessionConnectionRuntime({
    events,
    logger,
    channelsRef,
    currentChannelId,
    governance,
    messageFlow,
    scope,
    onWsEvent,
  });

  // 频道切换、读状态推进属于“当前频道视图动作”，和底层连接生命周期拆开装配。
  const channelViewActions = createChannelViewActions({
    state: sessionState,
    loadChannelMessages: messageFlow.loadChannelMessages,
    refreshMembersRail: governance.refreshMembersRail,
    readStateReporter,
  });

  /**
   * 在切服或当前 scope 被替换后，把所有 room-session 相关本地状态重置为干净视图。
   *
   * 为什么放在这里：
   * - reset 需要同时接触连接状态、消息分页状态、读状态和 composer 局部状态；
   * - 因此它天然属于 session 这个更高层的协调点。
   */
  function resetForServerChange(): void {
    resetRoomSessionState({
      teardownConnectionLifecycle: connectionRuntime.teardownConnectionLifecycle,
      state: sessionState,
    });
  }

  return {
    ensureChatReady: connectionRuntime.ensureChatReady,
    resetForServerChange,
    ...channelViewActions,
  };
}
