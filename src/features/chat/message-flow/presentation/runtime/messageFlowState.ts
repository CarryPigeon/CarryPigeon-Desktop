/**
 * @fileoverview chat message-flow state
 * @description
 * 承载 message-flow 维度的基础状态与派生视图：
 * 消息列表、分页、composer 草稿与消息动作错误。
 */

import { computed, reactive, ref, type Ref } from "vue";
import type { ChatMessage, ChatMessageActionErrorInfo, MessageMention, MessageReplySummary, MessageSearchState } from "@/features/chat/message-flow/api-types";
import { createLocalStorageDraftStorage } from "@/features/chat/message-flow/draft/data/localStorageDraftStorage";

/**
 * 创建 message-flow 基础状态所需的依赖。
 */
export type CreateChatMessageFlowStateDeps = {
  currentChannelId: Ref<string>;
  currentServerSocket: Ref<string>;
};

/**
 * 创建 message-flow 相关状态。
 *
 * @param deps - 依赖的 session 状态。
 * @returns message-flow 状态与派生视图。
 */
export function createChatMessageFlowState(deps: CreateChatMessageFlowStateDeps) {
  const composerDraft = ref<string>("");
  const selectedDomainId = ref<string>("Core:Text");
  const replyDraft = ref<MessageReplySummary | null>(null);
  const draftMentions = ref<MessageMention[]>([]);
  const messageActionError = ref<ChatMessageActionErrorInfo | null>(null);
  const quoteReplyDraft = ref<{ messageId: string; userId: string; preview: string } | null>(null);
  const multiSelectMode = ref(false);
  const selectedMessageIds = ref<Set<string>>(new Set());

  const messagesByChannel = reactive<Record<string, ChatMessage[]>>({});
  const nextCursorByChannel = reactive<Record<string, string>>({});
  const hasMoreByChannel = reactive<Record<string, boolean>>({});
  const loadingMoreByChannel = reactive<Record<string, boolean>>({});
  const searchState = ref<MessageSearchState>({ query: "", loading: false, error: "", results: [] });
  const highlightedMessageId = ref<string>("");

  const currentMessages = computed(() => messagesByChannel[deps.currentChannelId.value] ?? []);
  const currentChannelHasMore = computed(() => Boolean(hasMoreByChannel[deps.currentChannelId.value]));
  const currentChannelLoadingMore = computed(() => Boolean(loadingMoreByChannel[deps.currentChannelId.value]));

  const replyToMessageId = computed(() => replyDraft.value?.messageId ?? "");

  const draftStorage = createLocalStorageDraftStorage(
    () => deps.currentServerSocket?.value ?? "",
  );

  function readChannelDraft(channelId: string): string {
    return draftStorage.readDraft(channelId)?.text ?? "";
  }
  function saveChannelDraft(channelId: string, text: string): void {
    if (!text.trim()) {
      draftStorage.deleteDraft(channelId);
      return;
    }
    draftStorage.saveDraft({ channelId, text, updatedAt: Date.now() });
  }
  function clearChannelDraft(channelId: string): void {
    draftStorage.deleteDraft(channelId);
  }

  return {
    composerDraft,
    selectedDomainId,
    replyDraft,
    draftMentions,
    quoteReplyDraft,
    multiSelectMode,
    selectedMessageIds,
    replyToMessageId,
    messageActionError,
    messagesByChannel,
    nextCursorByChannel,
    hasMoreByChannel,
    loadingMoreByChannel,
    searchState,
    highlightedMessageId,
    currentMessages,
    currentChannelHasMore,
    currentChannelLoadingMore,
    readChannelDraft,
    saveChannelDraft,
    clearChannelDraft,
  };
}
