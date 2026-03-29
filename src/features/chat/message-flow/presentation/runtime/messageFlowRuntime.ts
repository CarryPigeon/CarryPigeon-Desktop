/**
 * @fileoverview chat 消息流运行时装配。
 * @description
 * 聚合 message-flow 子域所需的分页、消息动作、composer 动作与 domain 视图能力。
 */

import type { ChatReadStateReporterPort } from "@/features/chat/application/ports/runtimePorts";
import { getAvailableChatMessageDomains, resolveChatDomainPluginHint } from "@/features/chat/data/plugin-runtime";
import {
  compareMessages,
  createAvailableDomains,
  createComposerActions,
  createMessageActions,
  createMessageMapper,
  createMessagePaging,
  mergeMessages,
} from "@/features/chat/message-flow/internal";
import type { ChatApiGateway } from "@/features/chat/presentation/store/live/chatGateway";
import type { ChatRuntimeScopePort } from "@/features/chat/presentation/store/live/chatScopePort";
import {
  createMessageComposerStatePort,
  createMessageTimelineStatePort,
} from "./messageFlowStatePorts";
import {
  ChatMessageFlowRuntimePort,
  ChatMessageFlowStateSlice,
} from "./messageFlowRuntimePorts";

export type ChatMessageFlowRuntimeDeps = {
  /**
   * 该依赖集合对应 message-flow 的三层关注点：
   * - timeline 分页状态
   * - composer 局部状态
   * - 共享 scope / token / read reporter
   */
  api: ChatApiGateway;
  currentChannelId: ChatMessageFlowStateSlice["currentChannelId"];
  messagesByChannel: ChatMessageFlowStateSlice["messagesByChannel"];
  nextCursorByChannel: ChatMessageFlowStateSlice["nextCursorByChannel"];
  hasMoreByChannel: ChatMessageFlowStateSlice["hasMoreByChannel"];
  loadingMoreByChannel: ChatMessageFlowStateSlice["loadingMoreByChannel"];
  selectedDomainId: ChatMessageFlowStateSlice["selectedDomainId"];
  composerDraft: ChatMessageFlowStateSlice["composerDraft"];
  replyToMessageId: ChatMessageFlowStateSlice["replyToMessageId"];
  messageActionError: ChatMessageFlowStateSlice["messageActionError"];
  readStateReporter: ChatReadStateReporterPort;
  scope: ChatRuntimeScopePort;
};

export function createChatMessageFlowRuntime(
  deps: ChatMessageFlowRuntimeDeps,
): ChatMessageFlowRuntimePort {
  const {
    api,
    currentChannelId,
    messagesByChannel,
    nextCursorByChannel,
    hasMoreByChannel,
    loadingMoreByChannel,
    selectedDomainId,
    composerDraft,
    replyToMessageId,
    messageActionError,
    readStateReporter,
    scope,
  } = deps;
  const { mapWireMessage } = createMessageMapper({
    resolveDomainPluginHint: resolveChatDomainPluginHint,
  });
  const timelineState = createMessageTimelineStatePort({
    currentChannelId,
    messagesByChannel,
    nextCursorByChannel,
    hasMoreByChannel,
    loadingMoreByChannel,
  });
  const composerState = createMessageComposerStatePort({
    selectedDomainId,
    composerDraft,
    replyToMessageId,
    messageActionError,
  });

  // 分页只关心“如何取消息页并合并进 timeline”。
  const paging = createMessagePaging({
    api,
    mapWireMessage,
    mergeMessages,
    scope,
    timelineState,
  });

  // 可用 domain 列表来自 Core domain + plugin runtime 暴露的扩展 domain。
  const { availableDomains } = createAvailableDomains({
    getActiveServerSocket: scope.getActiveServerSocket,
    getAvailableMessageDomains: getAvailableChatMessageDomains,
  });

  // 删除动作单独抽出，避免 composer 动作承担过多职责。
  const { deleteMessage } = createMessageActions({
    api,
    scope,
    timelineState,
    composerState,
  });

  // composer 负责 draft / reply / send，不负责分页或治理。
  const composerActions = createComposerActions({
    api,
    scope,
    timelineState,
    composerState,
    mapWireMessage,
    readStateReporter,
  });

  return {
    availableDomains,
    deleteMessage,
    mapWireMessage,
    compareMessages,
    ...paging,
    ...composerActions,
  };
}
