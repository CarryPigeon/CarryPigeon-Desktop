/**
 * @fileoverview chat 消息流运行时装配。
 * @description
 * 聚合 message-flow 子域所需的分页、消息动作、composer 动作与 domain 视图能力。
 */

import type { ChatReadStateReporterPort } from "@/features/chat/application/ports/runtimePorts";
import { getAvailableChatMessageDomains, resolveChatDomainPluginHint } from "@/features/chat/integration/pluginRuntime";
import {
  compareMessages,
  createAvailableDomains,
  createComposerActions,
  createMessageActions,
  createMessageMapper,
  createMessagePaging,
  mergeMessages,
} from "@/features/chat/message-flow/internal";
import type { ChatApiGateway } from "./chatGateway";
import type { ChatRuntimeScopePort } from "./chatScopePort";
import type { ChatMessageFlowRuntimePort, ChatMessageFlowStateSlice } from "./chatMessageFlowRuntimePorts";

export type ChatMessageFlowRuntimeDeps = {
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

  const paging = createMessagePaging({
    api,
    mapWireMessage,
    mergeMessages,
    getSocketAndValidToken: scope.getSocketAndValidToken,
    getActiveServerSocket: scope.getActiveServerSocket,
    getActiveScopeVersion: scope.getActiveScopeVersion,
    currentChannelId,
    messagesByChannel,
    nextCursorByChannel,
    hasMoreByChannel,
    loadingMoreByChannel,
  });

  const { availableDomains } = createAvailableDomains({
    getActiveServerSocket: scope.getActiveServerSocket,
    getAvailableMessageDomains: getAvailableChatMessageDomains,
  });

  const { deleteMessage } = createMessageActions({
    api,
    getSocketAndValidToken: scope.getSocketAndValidToken,
    getActiveServerSocket: scope.getActiveServerSocket,
    getActiveScopeVersion: scope.getActiveScopeVersion,
    currentChannelId,
    messagesByChannel,
    messageActionError,
  });

  const composerActions = createComposerActions({
    api,
    getSocketAndValidToken: scope.getSocketAndValidToken,
    getActiveServerSocket: scope.getActiveServerSocket,
    getActiveScopeVersion: scope.getActiveScopeVersion,
    currentChannelId,
    messagesByChannel,
    selectedDomainId,
    composerDraft,
    replyToMessageId,
    messageActionError,
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
