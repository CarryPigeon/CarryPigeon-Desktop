/**
 * @fileoverview message-flow runtime state -> application port adapters
 * @description
 * 把 message-flow runtime 使用的 Vue/ref/reactive 状态容器适配为
 * application 层可消费的显式状态端口。
 */

import type { Ref } from "vue";
import type {
  MessageComposerStatePort,
  MessageTimelineStatePort,
} from "@/features/chat/message-flow/domain/ports";
import type { ChatMessage, ChatMessageActionErrorInfo, MessageMention, MessageReplySummary, MessageSearchState } from "@/features/chat/message-flow/api-types";
import type { MessageReactionSummary } from "@/features/chat/message-flow/domain/contracts";

/**
 * 创建消息时间线状态端口所需的底层状态容器。
 */
export type CreateMessageTimelineStatePortDeps = {
  currentChannelId: Ref<string>;
  messagesByChannel: Record<string, ChatMessage[]>;
  nextCursorByChannel: Record<string, string>;
  hasMoreByChannel: Record<string, boolean>;
  loadingMoreByChannel: Record<string, boolean>;
  searchState: Ref<MessageSearchState>;
  highlightedMessageId: Ref<string>;
};

/**
 * 将 runtime 层消息时间线状态适配为 application 端口。
 */
export function createMessageTimelineStatePort(
  deps: CreateMessageTimelineStatePortDeps,
): MessageTimelineStatePort {
  return {
    readCurrentChannelId(): string {
      return deps.currentChannelId.value.trim();
    },
    listMessages(channelId: string): readonly ChatMessage[] {
      return deps.messagesByChannel[channelId] ?? [];
    },
    replaceTimeline(channelId: string, messages: readonly ChatMessage[]): void {
      deps.messagesByChannel[channelId] = [...messages];
    },
    appendMessageIfMissing(
      channelId: string,
      message: ChatMessage,
      compareMessages: (a: ChatMessage, b: ChatMessage) => number,
    ): boolean {
      const list = deps.messagesByChannel[channelId] ?? (deps.messagesByChannel[channelId] = []);
      if (list.some((entry) => entry.id === message.id)) return false;
      list.push(message);
      list.sort(compareMessages);
      return true;
    },
    beginOptimisticMessageRemoval(channelId: string, messageId: string): { restore(): void } {
      const list = deps.messagesByChannel[channelId] ?? [];
      const index = list.findIndex((entry) => entry.id === messageId);
      const removed = index >= 0 ? list.splice(index, 1)[0] ?? null : null;
      return {
        restore(): void {
          if (!removed || index < 0) return;
          const target = deps.messagesByChannel[channelId] ?? (deps.messagesByChannel[channelId] = []);
          if (target.some((entry) => entry.id === removed.id)) return;
          target.splice(Math.min(index, target.length), 0, removed);
        },
      };
    },
    removeMessage(channelId: string, messageId: string): void {
      const list = deps.messagesByChannel[channelId] ?? [];
      const index = list.findIndex((entry) => entry.id === messageId);
      if (index >= 0) list.splice(index, 1);
    },
    updateMessageReactions(channelId: string, messageId: string, reactions: MessageReactionSummary[]): void {
      const list = deps.messagesByChannel[channelId] ?? [];
      const idx = list.findIndex((m) => m.id === messageId);
      if (idx >= 0) {
        list.splice(idx, 1, { ...list[idx], reactions });
      }
    },
    readNextCursor(channelId: string): string {
      return String(deps.nextCursorByChannel[channelId] ?? "").trim();
    },
    writeNextCursor(channelId: string, nextCursor: string): void {
      deps.nextCursorByChannel[channelId] = String(nextCursor ?? "").trim();
    },
    readHasMore(channelId: string): boolean {
      return Boolean(deps.hasMoreByChannel[channelId]);
    },
    writeHasMore(channelId: string, hasMore: boolean): void {
      deps.hasMoreByChannel[channelId] = hasMore;
    },
    isLoadingMore(channelId: string): boolean {
      return Boolean(deps.loadingMoreByChannel[channelId]);
    },
    setLoadingMore(channelId: string, loading: boolean): void {
      deps.loadingMoreByChannel[channelId] = loading;
    },
    writeSearchState(state: MessageSearchState): void {
      deps.searchState.value = state;
    },
    readSearchState(): MessageSearchState {
      return deps.searchState.value;
    },
    setHighlightedMessageId(messageId: string): void {
      deps.highlightedMessageId.value = messageId.trim();
    },
    readHighlightedMessageId(): string {
      return deps.highlightedMessageId.value.trim();
    },
  };
}

/**
 * 创建消息输入框状态端口所需的底层状态容器。
 */
export type CreateMessageComposerStatePortDeps = {
  selectedDomainId: Ref<string>;
  composerDraft: Ref<string>;
  replyDraft: Ref<MessageReplySummary | null>;
  draftMentions: Ref<MessageMention[]>;
  messageActionError: Ref<ChatMessageActionErrorInfo | null>;
  quoteReplyDraft: Ref<{ messageId: string; userId: string; preview: string } | null>;
  readChannelDraft: (channelId: string) => string;
  saveChannelDraft: (channelId: string, text: string) => void;
  clearChannelDraft: (channelId: string) => void;
};

/**
 * 将 runtime 层输入框状态适配为 application 端口。
 */
export function createMessageComposerStatePort(
  deps: CreateMessageComposerStatePortDeps,
): MessageComposerStatePort {
  return {
    readSelectedDomainId(): string {
      return deps.selectedDomainId.value.trim();
    },
    readDraft(): string {
      return deps.composerDraft.value;
    },
    replaceDraft(value: string): void {
      deps.composerDraft.value = value;
    },
    clearDraft(): void {
      deps.composerDraft.value = "";
    },
    readReplyDraft(): MessageReplySummary | null {
      return deps.replyDraft.value;
    },
    setReplyDraft(reply: MessageReplySummary): void {
      deps.replyDraft.value = reply;
    },
    clearReplyDraft(): void {
      deps.replyDraft.value = null;
    },
    readReplyToMessageId(): string {
      return deps.replyDraft.value?.messageId ?? "";
    },
    setReplyToMessageId(messageId: string): void {
      deps.replyDraft.value = messageId.trim()
        ? {
            messageId: messageId.trim(),
            senderName: "Unknown",
            preview: "",
            createdAt: 0,
          }
        : null;
    },
    clearReplyToMessageId(): void {
      deps.replyDraft.value = null;
    },
    listDraftMentions(): MessageMention[] {
      return [...deps.draftMentions.value];
    },
    addDraftMention(mention: MessageMention): void {
      const userId = mention.userId.trim();
      if (!userId) return;
      if (deps.draftMentions.value.some((entry) => entry.userId === userId)) return;
      deps.draftMentions.value = [...deps.draftMentions.value, { userId, displayName: mention.displayName.trim() || userId, type: mention.type }];
    },
    removeDraftMention(userId: string): void {
      const target = userId.trim();
      deps.draftMentions.value = deps.draftMentions.value.filter((entry) => entry.userId !== target);
    },
    clearDraftMentions(): void {
      deps.draftMentions.value = [];
    },
    writeActionError(error: ChatMessageActionErrorInfo | null): void {
      deps.messageActionError.value = error;
    },
    readQuoteReplyDraft(): { messageId: string; userId: string; preview: string } | null {
      return deps.quoteReplyDraft.value;
    },
    setQuoteReplyDraft(quote: { messageId: string; userId: string; preview: string }): void {
      deps.quoteReplyDraft.value = quote;
    },
    clearQuoteReplyDraft(): void {
      deps.quoteReplyDraft.value = null;
    },
    readChannelDraft(channelId: string): string {
      return deps.readChannelDraft(channelId);
    },
    saveChannelDraft(channelId: string, text: string): void {
      deps.saveChannelDraft(channelId, text);
    },
    clearChannelDraft(channelId: string): void {
      deps.clearChannelDraft(channelId);
    },
  };
}
