/**
 * @fileoverview chat Store 装配辅助函数。
 * @description
 * 收敛 chat 实时 Store 的装配细节，避免最终 composition root 再次膨胀。
 */

import { getCurrentChatUserId } from "@/features/chat/data/account-session";
import { createMessageTimelineStatePort } from "@/features/chat/message-flow/presentation/runtime/messageFlowStatePorts";
import { emitChannelProjectionChanged } from "@/features/chat/presentation/shared/windowMessageEvents";
import { createChatEventRouter } from "@/features/chat/composition/createChatEventRouter";
import {
  createSessionReadStateEventProjectionPort,
  createSessionUnreadProjectionPort,
} from "@/features/chat/room-session/presentation/runtime/sessionStatePorts";
import type { ChatApiGateway, ChatEventsGateway } from "@/features/chat/composition/contracts/chatGateway";
import { createChatStoreState } from "@/features/chat/composition/store/createChatStoreState";
import { createChatMessageFlowRuntime } from "@/features/chat/message-flow/presentation/runtime/messageFlowRuntime";
import { createChatGovernanceRuntime } from "@/features/chat/room-governance/presentation/runtime/governanceRuntime";
import { createChatSessionRuntime } from "@/features/chat/room-session/presentation/runtime/sessionRuntime";
import { createChatSessionSharedContext } from "@/features/chat/room-session/presentation/runtime/sessionSharedContext";

type LoggerLike = {
  debug(message: string, payload?: Record<string, unknown>): void;
  info(message: string, payload?: Record<string, unknown>): void;
  warn(message: string, payload?: Record<string, unknown>): void;
};

/**
 * chat store runtime 装配依赖。
 */
export type ChatStoreAssemblyDeps = {
  /**
   * 供各子域共享的 chat API gateway。
   */
  api: ChatApiGateway;
  /**
   * 供 room-session 使用的事件流 gateway。
   */
  events: ChatEventsGateway;
  /**
   * 统一日志输出面。
   */
  logger: LoggerLike;
};

/**
 * 组装 chat 各局部运行时与共享状态。
 *
 * 说明：
 * - 该函数负责明确“先共享上下文，再 governance/message-flow，最后 session”的装配顺序；
 * - `chatRuntimeStore.ts` 只消费最终装配结果，不再关心中间细节。
 */
export function assembleChatStoreRuntime(deps: ChatStoreAssemblyDeps) {
  /**
   * 第一步：创建 chat 聚合响应式状态。
   *
   * 这仍是 feature 内部实现细节，后续会被适配成更窄的 runtime/capability 面。
   */
  const state = createChatStoreState();
  const {
    channelsRef,
    composerDraft,
    currentChannelId,
    lastReadMidByChannel,
    lastReadReportAtMsByChannel,
    lastReadTimeMsByChannel,
    members,
    messageActionError,
    replyToMessageId,
    scopeVersion,
    selectedDomainId,
  } = state;

  /**
   * 第二步：先装配三个子域共享的会话上下文。
   *
   * 它提供：
   * - scope/token
   * - 目录刷新
   * - 读状态上报
   */
  const sessionSharedContext = createChatSessionSharedContext({
    api: deps.api,
    channelsRef,
    scopeVersion,
    lastReadTimeMsByChannel,
    lastReadMidByChannel,
    lastReadReportAtMsByChannel,
  });

  /**
   * 第三步：装配 governance runtime。
   *
   * governance 依赖 shared context 的 scope 与 refreshChannels，但还不依赖 message-flow。
   */
  const governance = createChatGovernanceRuntime({
    api: deps.api,
    channelsRef,
    currentChannelId,
    members,
    scopeVersion,
    refreshChannels: sessionSharedContext.refreshChannels,
    scope: sessionSharedContext.scope,
  });

  /**
   * 第四步：装配 message-flow runtime。
   *
   * message-flow 依赖 shared context 的 scope/readStateReporter，
   * 但不直接依赖 room-session 的连接生命周期。
   */
  const messageFlow = createChatMessageFlowRuntime({
    api: deps.api,
    currentChannelId,
    messagesByChannel: state.messagesByChannel,
    nextCursorByChannel: state.nextCursorByChannel,
    hasMoreByChannel: state.hasMoreByChannel,
    loadingMoreByChannel: state.loadingMoreByChannel,
    selectedDomainId,
    composerDraft,
    replyToMessageId,
    messageActionError,
    readStateReporter: sessionSharedContext.readStateReporter,
    scope: sessionSharedContext.scope,
  });

  const timelineState = createMessageTimelineStatePort({
    currentChannelId,
    messagesByChannel: state.messagesByChannel,
    nextCursorByChannel: state.nextCursorByChannel,
    hasMoreByChannel: state.hasMoreByChannel,
    loadingMoreByChannel: state.loadingMoreByChannel,
  });
  const unreadProjection = createSessionUnreadProjectionPort({
    channelsRef,
  });
  const readStateProjection = createSessionReadStateEventProjectionPort({
    channelsRef,
    lastReadTimeMsByChannel,
    lastReadMidByChannel,
  });
  /**
   * 第五步：创建 WS 事件总路由器。
   *
   * 它把跨子域事件分发给：
   * - 时间线增量更新
   * - 未读角标更新
   * - 读状态投影更新
   * - 目录/治理相关刷新
   */
  const onWsEvent = createChatEventRouter({
    logger: deps.logger,
    getServerSocket: sessionSharedContext.scope.getActiveServerSocket,
    getCurrentUserId: getCurrentChatUserId,
    timelineState,
    unreadProjection,
    readStateProjection,
    refreshChannels: governance.refreshChannels,
    refreshChannelLatestPage: messageFlow.refreshChannelLatestPage,
    refreshMembersRail: governance.refreshMembersRail,
    emitChannelProjectionChanged,
    mapWireMessage: messageFlow.mapWireMessage,
    compareMessages: messageFlow.compareMessages,
  });

  /**
   * 第六步：最后装配 room-session runtime。
   *
   * session 处在最上层，因为它同时依赖：
   * - governance runtime
   * - message-flow runtime
   * - 共享 scope / readStateReporter
   * - 事件路由入口
   */
  const session = createChatSessionRuntime({
    events: deps.events,
    logger: deps.logger,
    channelsRef,
    currentChannelId,
    members,
    messagesByChannel: state.messagesByChannel,
    lastReadTimeMsByChannel,
    lastReadMidByChannel,
    lastReadReportAtMsByChannel,
    nextCursorByChannel: state.nextCursorByChannel,
    hasMoreByChannel: state.hasMoreByChannel,
    loadingMoreByChannel: state.loadingMoreByChannel,
    scopeVersion,
    messageActionError,
    composerDraft,
    replyToMessageId,
    selectedDomainId,
    governance,
    messageFlow,
    scope: sessionSharedContext.scope,
    readStateReporter: sessionSharedContext.readStateReporter,
    onWsEvent,
  });

  return {
    state,
    sessionSharedContext,
    governance,
    messageFlow,
    session,
  };
}
