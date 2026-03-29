/**
 * @fileoverview message-flow presentation store access。
 * @description
 * 这是 message-flow presentation/runtime 内部使用的 store 访问面。
 * 它只转发 runtime 管理的当前子域 store，不暴露聚合 store 或内部运行时实现。
 */

import { computed } from "vue";
import { getMessageFlowStore } from "@/features/chat/application/runtime/runtimeAccess";
import type {
  ChatMessage,
  ChatMessageActionErrorInfo,
  ComposerSubmitPayload,
  DeleteChatMessageOutcome,
  SendChatMessageOutcome,
} from "@/features/chat/message-flow/api-types";

/**
 * 延迟解析当前 message-flow store，避免 import 时绑定到过期 runtime。
 */
function resolveMessageFlowStore(): ReturnType<typeof getMessageFlowStore> {
  return getMessageFlowStore();
}

export const composerDraft = computed({
  get: () => resolveMessageFlowStore().composerDraft.value,
  set: (value: string) => {
    resolveMessageFlowStore().composerDraft.value = value;
  },
});
export const currentChannelHasMore = computed(() => resolveMessageFlowStore().currentChannelHasMore.value);
export const currentMessages = computed(() => resolveMessageFlowStore().currentMessages.value);
export const loadingMoreMessages = computed(() => resolveMessageFlowStore().loadingMoreMessages.value);
export const replyToMessageId = computed({
  get: () => resolveMessageFlowStore().replyToMessageId.value,
  set: (value: string) => {
    resolveMessageFlowStore().replyToMessageId.value = value;
  },
});
export const selectedDomainId = computed({
  get: () => resolveMessageFlowStore().selectedDomainId.value,
  set: (value: string) => {
    resolveMessageFlowStore().selectedDomainId.value = value;
  },
});
export const messageActionError = computed({
  get: () => resolveMessageFlowStore().messageActionError.value,
  set: (value: ChatMessageActionErrorInfo | null) => {
    resolveMessageFlowStore().messageActionError.value = value;
  },
});

export function availableDomains() {
  return resolveMessageFlowStore().availableDomains();
}

export function cancelReply(): void {
  return resolveMessageFlowStore().cancelReply();
}

export function deleteMessage(messageId: string): Promise<DeleteChatMessageOutcome> {
  return resolveMessageFlowStore().deleteMessage(messageId);
}

export function getMessageById(channelId: string, messageId: string): ChatMessage | null {
  return resolveMessageFlowStore().getMessageById(channelId, messageId);
}

export function loadMoreMessages(): Promise<void> {
  return resolveMessageFlowStore().loadMoreMessages();
}

export function sendComposerMessage(payload?: ComposerSubmitPayload): Promise<SendChatMessageOutcome> {
  return resolveMessageFlowStore().sendComposerMessage(payload);
}

export function startReply(messageId: string): void {
  return resolveMessageFlowStore().startReply(messageId);
}

export type { ChatMessage, ComposerSubmitPayload };
