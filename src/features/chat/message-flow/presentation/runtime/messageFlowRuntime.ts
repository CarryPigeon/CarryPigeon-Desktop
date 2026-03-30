/**
 * @fileoverview chat 消息流运行时装配。
 * @description
 * 聚合 message-flow 子域所需的分页、消息动作、composer 动作与 domain 视图能力。
 */

import type { ChatReadStateReporterPort } from "@/features/chat/domain/ports/runtimePorts";
import { getAvailableChatMessageDomains, resolveChatDomainPluginHint } from "@/features/chat/data/plugins/chatPluginRuntime";
import {
  compareMessages,
  createAvailableDomains,
  createMessageMapper,
  MessageFlowApplicationService,
  mergeMessages,
} from "@/features/chat/message-flow/internal";
import type { ChatApiGateway } from "@/features/chat/composition/contracts/chatGateway";
import type { ChatRuntimeScopePort } from "@/features/chat/composition/contracts/chatScopePort";
import {
  createMessageComposerStatePort,
  createMessageTimelineStatePort,
} from "./messageFlowStatePorts";
import {
  ChatMessageFlowRuntimePort,
  ChatMessageFlowStateSlice,
} from "./messageFlowRuntimePorts";

/**
 * message-flow runtime 装配依赖。
 */
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

/**
 * 创建 message-flow runtime。
 *
 * runtime 的职责是装配状态端口、application service 与外部 capability；
 * 具体业务规则仍留在 application 层。
 */
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

  /**
   * message-flow runtime 不自己编写业务动作，
   * 而是把状态端口与远端 gateway 交给 application service。
   */
  const applicationService = new MessageFlowApplicationService({
    api,
    mapWireMessage,
    scope,
    timelineState,
    composerState,
    mergeMessages,
    readStateReporter,
  });

  // 可用 domain 列表来自 Core domain + plugin runtime 暴露的扩展 domain。
  const { availableDomains } = createAvailableDomains({
    getActiveServerSocket: scope.getActiveServerSocket,
    getAvailableMessageDomains: getAvailableChatMessageDomains,
  });

  return {
    availableDomains,
    mapWireMessage,
    compareMessages,
    loadChannelMessages: (channelId) => applicationService.loadChannelMessages(channelId),
    refreshChannelLatestPage: (channelId) => applicationService.refreshChannelLatestPage(channelId),
    loadMoreMessages: () => applicationService.loadMoreMessages(),
    deleteMessage: (messageId) => applicationService.deleteMessage(messageId),
    startReply: (messageId) => applicationService.startReply(messageId),
    cancelReply: () => applicationService.cancelReply(),
    sendComposerMessage: (payload) => applicationService.sendComposerMessage(payload),
  };
}
