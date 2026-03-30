/**
 * @fileoverview message-flow presentation store access。
 * @description
 * 这是 message-flow presentation/runtime 内部使用的 store 访问面。
 * 它只转发 runtime 管理的当前子域 store，不暴露聚合 store 或内部运行时实现。
 */

import { computed } from "vue";
import { getMessageFlowStore } from "@/features/chat/composition/runtimeAccess";
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

/**
 * composer 草稿双向投影。
 */
export const composerDraft = computed({
  get: () => resolveMessageFlowStore().composerDraft.value,
  set: (value: string) => {
    resolveMessageFlowStore().composerDraft.value = value;
  },
});
/**
 * 当前频道是否还有可继续加载的历史消息。
 */
export const currentChannelHasMore = computed(() => resolveMessageFlowStore().currentChannelHasMore.value);
/**
 * 当前频道时间线消息列表。
 */
export const currentMessages = computed(() => resolveMessageFlowStore().currentMessages.value);
/**
 * 当前是否正在执行历史翻页。
 */
export const loadingMoreMessages = computed(() => resolveMessageFlowStore().loadingMoreMessages.value);
/**
 * 当前回复目标消息 id 双向投影。
 */
export const replyToMessageId = computed({
  get: () => resolveMessageFlowStore().replyToMessageId.value,
  set: (value: string) => {
    resolveMessageFlowStore().replyToMessageId.value = value;
  },
});
/**
 * 当前选中消息 domain id 双向投影。
 */
export const selectedDomainId = computed({
  get: () => resolveMessageFlowStore().selectedDomainId.value,
  set: (value: string) => {
    resolveMessageFlowStore().selectedDomainId.value = value;
  },
});
/**
 * 当前消息动作错误双向投影。
 */
export const messageActionError = computed({
  get: () => resolveMessageFlowStore().messageActionError.value,
  set: (value: ChatMessageActionErrorInfo | null) => {
    resolveMessageFlowStore().messageActionError.value = value;
  },
});

/**
 * 查询当前可用消息 domain 列表。
 */
export function availableDomains() {
  return resolveMessageFlowStore().availableDomains();
}

/**
 * 退出回复态。
 */
export function cancelReply(): void {
  return resolveMessageFlowStore().cancelReply();
}

/**
 * 删除指定消息。
 */
export function deleteMessage(messageId: string): Promise<DeleteChatMessageOutcome> {
  return resolveMessageFlowStore().deleteMessage(messageId);
}

/**
 * 在指定频道中按 id 查询消息。
 */
export function getMessageById(channelId: string, messageId: string): ChatMessage | null {
  return resolveMessageFlowStore().getMessageById(channelId, messageId);
}

/**
 * 对当前频道执行历史翻页。
 */
export function loadMoreMessages(): Promise<void> {
  return resolveMessageFlowStore().loadMoreMessages();
}

/**
 * 发送消息。
 *
 * 当 `payload` 为空时表示发送当前 draft；
 * 当 `payload` 存在时表示发送结构化 composer 结果。
 */
export function sendComposerMessage(payload?: ComposerSubmitPayload): Promise<SendChatMessageOutcome> {
  return resolveMessageFlowStore().sendComposerMessage(payload);
}

/**
 * 进入回复态。
 */
export function startReply(messageId: string): void {
  return resolveMessageFlowStore().startReply(messageId);
}

export type { ChatMessage, ComposerSubmitPayload };
