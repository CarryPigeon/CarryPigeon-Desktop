/**
 * @fileoverview chat Store 装配辅助函数。
 * @description
 * 收敛 chat 实时 Store 的装配细节，避免最终 composition root 再次膨胀。
 */

import { getCurrentChatUserId } from "@/features/chat/data/account-session";
import { createMessageTimelineStatePort } from "@/features/chat/message-flow/presentation/runtime/messageFlowStatePorts";
import { emitChannelProjectionChanged } from "@/features/chat/presentation/events/windowMessageEvents";
import { createChatEventRouter } from "@/features/chat/presentation/store/live/chatEventRouter";
import {
  createSessionReadStateEventProjectionPort,
  createSessionUnreadProjectionPort,
} from "@/features/chat/room-session/presentation/runtime/sessionStatePorts";
import type { ChatApiGateway, ChatEventsGateway } from "./chatGateway";
import { createChatStoreState } from "./chatStoreState";
import { createChatMessageFlowRuntime } from "@/features/chat/message-flow/presentation/runtime/messageFlowRuntime";
import { createChatGovernanceRuntime } from "@/features/chat/room-governance/presentation/runtime/governanceRuntime";
import { createChatSessionRuntime } from "@/features/chat/room-session/presentation/runtime/sessionRuntime";
import { createChatSessionSharedContext } from "@/features/chat/room-session/presentation/runtime/sessionSharedContext";

type LoggerLike = {
  debug(message: string, payload?: Record<string, unknown>): void;
  info(message: string, payload?: Record<string, unknown>): void;
  warn(message: string, payload?: Record<string, unknown>): void;
};

export type ChatStoreAssemblyDeps = {
  api: ChatApiGateway;
  events: ChatEventsGateway;
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

  const sessionSharedContext = createChatSessionSharedContext({
    api: deps.api,
    channelsRef,
    scopeVersion,
    lastReadTimeMsByChannel,
    lastReadMidByChannel,
    lastReadReportAtMsByChannel,
  });

  const governance = createChatGovernanceRuntime({
    api: deps.api,
    channelsRef,
    currentChannelId,
    members,
    scopeVersion,
    refreshChannels: sessionSharedContext.refreshChannels,
    scope: sessionSharedContext.scope,
  });

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
