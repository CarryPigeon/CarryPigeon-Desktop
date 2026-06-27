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
} from "@/features/chat/message-flow/internal";
import { createAdaptiveMergeMessages } from "@/features/chat/message-flow/application/createAdaptiveMergeMessages";
import { createAdaptiveMessageSorter } from "@/features/chat/message-flow/application/adaptiveMessageSorter";
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
import { createLocalStorageDraftStorage } from "@/features/chat/message-flow/draft/data/localStorageDraftStorage";

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
  searchState: ChatMessageFlowStateSlice["searchState"];
  serverSearchResults: ChatMessageFlowStateSlice["serverSearchResults"];
  searchScope: ChatMessageFlowStateSlice["searchScope"];
  highlightedMessageId: ChatMessageFlowStateSlice["highlightedMessageId"];
  selectedDomainId: ChatMessageFlowStateSlice["selectedDomainId"];
  composerDraft: ChatMessageFlowStateSlice["composerDraft"];
  replyDraft: ChatMessageFlowStateSlice["replyDraft"];
  draftMentions: ChatMessageFlowStateSlice["draftMentions"];
  quoteReplyDraft: ChatMessageFlowStateSlice["quoteReplyDraft"];
  replyToMessageId: ChatMessageFlowStateSlice["replyToMessageId"];
  messageActionError: ChatMessageFlowStateSlice["messageActionError"];
  readStateReporter: ChatReadStateReporterPort;
  scope: ChatRuntimeScopePort;
  currentUserId: string;
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
    searchState,
    serverSearchResults,
    searchScope,
    highlightedMessageId,
    selectedDomainId,
    composerDraft,
    replyDraft,
    draftMentions,
    quoteReplyDraft,
    replyToMessageId: _replyToMessageId,
    messageActionError,
    readStateReporter,
    scope,
    currentUserId,
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
    searchState,
    serverSearchResults,
    searchScope,
    highlightedMessageId,
  });
  const draftStorage = createLocalStorageDraftStorage(
    () => scope.getActiveServerSocket(),
  );

  const draftReadChannelDraft = (channelId: string): string =>
    draftStorage.readDraft(channelId)?.text ?? "";
  const draftSaveChannelDraft = (channelId: string, text: string): void => {
    if (!text.trim()) {
      draftStorage.deleteDraft(channelId);
      return;
    }
    draftStorage.saveDraft({ channelId, text, updatedAt: Date.now() });
  };
  const draftClearChannelDraft = (channelId: string): void => {
    draftStorage.deleteDraft(channelId);
  };

  const composerState = createMessageComposerStatePort({
    selectedDomainId,
    composerDraft,
    replyDraft,
    draftMentions,
    quoteReplyDraft,
    messageActionError,
    readChannelDraft: draftReadChannelDraft,
    saveChannelDraft: draftSaveChannelDraft,
    clearChannelDraft: draftClearChannelDraft,
  });

  const messageSorter = createAdaptiveMessageSorter();
  const mergeMessages = createAdaptiveMergeMessages(messageSorter);

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
    currentUserId,
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
    editMessage: (messageId, request) => applicationService.editMessage(messageId, request),
    recallMessage: (messageId) => applicationService.recallMessage(messageId),
    startReply: (message) => applicationService.startReply(message),
    cancelReply: () => applicationService.cancelReply(),
    sendComposerMessage: (payload) => applicationService.sendComposerMessage(payload),
    reactToMessage: (messageId, emoji) => applicationService.reactToMessage(messageId, emoji),
    removeReaction: (messageId, emoji) => applicationService.removeReaction(messageId, emoji),
    listMentionCandidates: (channelId) => applicationService.listMentionCandidates(channelId),
    searchCurrentChannel: (query) => applicationService.searchCurrentChannel(query),
    searchServerMessages: (query, channelIds) => applicationService.searchServerMessages(query, channelIds),
    loadContextAroundMessage: (messageId) => applicationService.loadContextAroundMessage(messageId),
    clearSearch: () => applicationService.clearSearch(),
  };
}
