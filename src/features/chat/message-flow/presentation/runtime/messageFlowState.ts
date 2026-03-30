/**
 * @fileoverview chat message-flow state
 * @description
 * 承载 message-flow 维度的基础状态与派生视图：
 * 消息列表、分页、composer 草稿与消息动作错误。
 */

import { computed, reactive, ref, type Ref } from "vue";
import type { ChatMessage, ChatMessageActionErrorInfo } from "@/features/chat/message-flow/api-types";

/**
 * 创建 message-flow 基础状态所需的依赖。
 */
export type CreateChatMessageFlowStateDeps = {
  currentChannelId: Ref<string>;
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
  const replyToMessageId = ref<string>("");
  const messageActionError = ref<ChatMessageActionErrorInfo | null>(null);

  const messagesByChannel = reactive<Record<string, ChatMessage[]>>({});
  const nextCursorByChannel = reactive<Record<string, string>>({});
  const hasMoreByChannel = reactive<Record<string, boolean>>({});
  const loadingMoreByChannel = reactive<Record<string, boolean>>({});

  const currentMessages = computed(() => messagesByChannel[deps.currentChannelId.value] ?? []);
  const currentChannelHasMore = computed(() => Boolean(hasMoreByChannel[deps.currentChannelId.value]));
  const currentChannelLoadingMore = computed(() => Boolean(loadingMoreByChannel[deps.currentChannelId.value]));

  return {
    composerDraft,
    selectedDomainId,
    replyToMessageId,
    messageActionError,
    messagesByChannel,
    nextCursorByChannel,
    hasMoreByChannel,
    loadingMoreByChannel,
    currentMessages,
    currentChannelHasMore,
    currentChannelLoadingMore,
  };
}
