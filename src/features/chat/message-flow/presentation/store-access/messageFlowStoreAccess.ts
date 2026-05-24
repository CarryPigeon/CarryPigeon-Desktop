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
  MentionCandidate,
  MessageMention,
  MessageReplySummary,
  ReactToMessageOutcome,
  RemoveReactionOutcome,
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
 * 当前搜索状态。
 */
export const searchState = computed(() => resolveMessageFlowStore().searchState.value);
/**
 * 当前高亮消息 id。
 */
export const highlightedMessageId = computed(() => resolveMessageFlowStore().highlightedMessageId.value);
/**
 * 当前回复目标草稿双向投影。
 */
export const replyDraft = computed({
  get: () => resolveMessageFlowStore().replyDraft.value,
  set: (value: MessageReplySummary | null) => {
    resolveMessageFlowStore().replyDraft.value = value;
  },
});

/**
 * 当前内联引用回复草稿双向投影。
 */
export const quoteReplyDraft = computed({
  get: () => resolveMessageFlowStore().quoteReplyDraft.value,
  set: (value: { messageId: string; userId: string; preview: string } | null) => {
    resolveMessageFlowStore().quoteReplyDraft.value = value;
  },
});

/**
 * 当前草稿提及列表只读投影。
 */
export const draftMentions = computed(() => resolveMessageFlowStore().draftMentions.value);

/**
 * 当前回复目标消息 id 双向投影（向后兼容）。
 */
export const replyToMessageId = computed({
  get: () => resolveMessageFlowStore().replyToMessageId.value,
  set: (value: string) => {
    resolveMessageFlowStore().replyDraft.value = value
      ? { messageId: value, senderName: "Unknown", preview: "", createdAt: 0 }
      : null;
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
export function startReply(message: ChatMessage): void {
  return resolveMessageFlowStore().startReply(message);
}

export function reactToMessage(messageId: string, emoji: string): Promise<ReactToMessageOutcome> {
  return resolveMessageFlowStore().reactToMessage(messageId, emoji);
}

export function removeReaction(messageId: string, emoji: string): Promise<RemoveReactionOutcome> {
  return resolveMessageFlowStore().removeReaction(messageId, emoji);
}

export function listMentionCandidates(channelId?: string): Promise<MentionCandidate[]> {
  return resolveMessageFlowStore().listMentionCandidates(channelId);
}

/**
 * 在当前频道中搜索消息。
 */
export function searchCurrentChannel(query: string): Promise<void> {
  return resolveMessageFlowStore().searchCurrentChannel(query);
}

/**
 * 加载某条消息周围的上下文并在 timeline 中高亮。
 */
export function loadContextAroundMessage(messageId: string): Promise<void> {
  return resolveMessageFlowStore().loadContextAroundMessage(messageId);
}

/**
 * 清除搜索状态。
 */
export function clearSearch(): void {
  return resolveMessageFlowStore().clearSearch();
}

/**
 * 添加一个提及到草稿提及列表。
 */
export function addMention(mention: MessageMention): void {
  const store = resolveMessageFlowStore();
  const userId = mention.userId.trim();
  if (!userId) return;
  if (store.draftMentions.value.some((entry) => entry.userId === userId)) return;
  store.draftMentions.value = [...store.draftMentions.value, { userId, displayName: mention.displayName.trim() || userId, type: mention.type }];
}

/**
 * Multi-select mode reference.
 */
export const multiSelectMode = computed({
  get: () => resolveMessageFlowStore().multiSelectMode.value,
  set: (v: boolean) => { resolveMessageFlowStore().multiSelectMode.value = v; },
});

/**
 * Check if a message is currently selected.
 */
export function isMessageSelected(id: string): boolean {
  return resolveMessageFlowStore().selectedMessageIds.value.has(id);
}

/**
 * Toggle a message's selection state.
 */
export function toggleMessageSelection(id: string): void {
  const set = resolveMessageFlowStore().selectedMessageIds.value;
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
  resolveMessageFlowStore().selectedMessageIds.value = new Set(set);
}

/**
 * Clear all selected messages and exit multi-select mode.
 */
export function clearSelection(): void {
  resolveMessageFlowStore().selectedMessageIds.value = new Set();
  resolveMessageFlowStore().multiSelectMode.value = false;
}

/**
 * Get the count of selected messages.
 */
export function getSelectedCount(): number {
  return resolveMessageFlowStore().selectedMessageIds.value.size;
}

/**
 * Get the sorted array of selected message IDs.
 */
export function getSelectedIds(): string[] {
  return [...resolveMessageFlowStore().selectedMessageIds.value];
}

export type { ChatMessage, ComposerSubmitPayload, MessageMention };
