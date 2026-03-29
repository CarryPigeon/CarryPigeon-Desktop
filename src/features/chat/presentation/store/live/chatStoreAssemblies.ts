/**
 * @fileoverview chat Store 装配辅助函数。
 * @description
 * 收敛 chat 实时 Store 的装配细节，避免最终 composition root 再次膨胀。
 */

import type { ChatApiGateway, ChatEventsGateway } from "./chatGateway";
import { createChatStoreState } from "./chatStoreState";
import { createChatGovernanceRuntime } from "./chatGovernanceRuntime";
import { createChatSessionRuntime } from "./chatSessionRuntime";
import { createChatMessageFlowRuntime } from "./chatMessageFlowRuntime";
import { createChatSessionSharedContext } from "./chatSessionSharedContext";

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
  });

  return {
    state,
    sessionSharedContext,
    governance,
    messageFlow,
    session,
  };
}
