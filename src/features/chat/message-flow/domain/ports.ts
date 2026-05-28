/**
 * @fileoverview message-flow 应用层输出端口。
 * @description chat/message-flow｜application：面向消息流用例编排的最小依赖集合。
 */

import type { ChatReadStateReporterPort } from "@/features/chat/domain/ports/runtimePorts";
import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type {
  ChatMessage,
  ChatMessageActionErrorInfo,
  MessageDomain,
  MessageMention,
  MessageReactionSummary,
  MessageReplySummary,
  MessageSearchState,
  ServerMessageSearchResult,
} from "@/features/chat/message-flow/domain/contracts";

/**
 * message-flow 应用层所需的最小 API 能力。
 */
export type MessageFlowApiPort = Pick<
  ChatApiPort,
  "sendChannelMessage" | "deleteMessage" | "recallMessage" | "editMessage" | "listChannelMessages" | "reactToMessage" | "removeReaction" | "searchChannelMessages" | "searchMessages" | "listChannelMessagesAround" | "listChannelMembers" | "getThreadReplies"
>;

/**
 * message-flow 发送消息后依赖的读状态推进能力。
 */
export type ReadStateReporterPort = ChatReadStateReporterPort;

/**
 * message-flow 查询可用消息 domain 的最小端口。
 */
export type AvailableMessageDomainsPort = {
  getActiveServerSocket(): string;
  getAvailableMessageDomains(serverSocket: string): MessageDomain[];
};

/**
 * message-flow 用例访问当前 runtime scope 的最小能力。
 */
export type MessageFlowScopePort = {
  getSocketAndValidToken(): Promise<[string, string]>;
  getActiveServerSocket(): string;
  getActiveScopeVersion(): number;
};

/**
 * message-flow 时间线状态读写端口。
 *
 * 说明：
 * - application 只能通过命名状态动作读写时间线与分页缓存；
 * - 禁止直接拿到 `Record<string, ChatMessage[]>` 或 Vue 容器。
 */
export type MessageTimelineStatePort = {
  readCurrentChannelId(): string;
  listMessages(channelId: string): readonly ChatMessage[];
  replaceTimeline(channelId: string, messages: readonly ChatMessage[]): void;
  appendMessageIfMissing(
    channelId: string,
    message: ChatMessage,
    compareMessages: (a: ChatMessage, b: ChatMessage) => number,
  ): boolean;
  beginOptimisticMessageRemoval(channelId: string, messageId: string): { restore(): void };
  removeMessage(channelId: string, messageId: string): void;
  /** 更新频道中某条消息的回应列表（用于 WS 事件和乐观更新）。 */
  updateMessageReactions(channelId: string, messageId: string, reactions: MessageReactionSummary[]): void;
  /** 更新频道中某条消息的全部字段（用于编辑事件和乐观更新）。 */
  updateMessage(channelId: string, messageId: string, updater: (old: ChatMessage) => ChatMessage): void;
  readNextCursor(channelId: string): string;
  writeNextCursor(channelId: string, nextCursor: string): void;
  readHasMore(channelId: string): boolean;
  writeHasMore(channelId: string, hasMore: boolean): void;
  isLoadingMore(channelId: string): boolean;
  setLoadingMore(channelId: string, loading: boolean): void;
  writeSearchState(state: MessageSearchState): void;
  readSearchState(): MessageSearchState;
  writeServerSearchState(state: { query: string; loading: boolean; error: string; results: ServerMessageSearchResult[] }): void;
  writeSearchScope(scope: "channel" | "server"): void;
  setHighlightedMessageId(messageId: string): void;
  readHighlightedMessageId(): string;
  /** 将消息标记为已撤回（将内容替换为占位符）。 */
  markMessageRecalled(channelId: string, messageId: string, recalledAt: number, recalledBy: string): void;
};

/**
 * message-flow composer 状态端口。
 */
export type MessageComposerStatePort = {
  readSelectedDomainId(): string;
  readDraft(): string;
  replaceDraft(value: string): void;
  clearDraft(): void;
  readReplyDraft(): MessageReplySummary | null;
  setReplyDraft(reply: MessageReplySummary): void;
  clearReplyDraft(): void;
  readReplyToMessageId(): string; // keep for backward compat
  setReplyToMessageId(messageId: string): void; // keep for backward compat
  clearReplyToMessageId(): void; // keep for backward compat
  writeActionError(error: ChatMessageActionErrorInfo | null): void;
  // New mention state
  listDraftMentions(): MessageMention[];
  addDraftMention(mention: MessageMention): void;
  removeDraftMention(userId: string): void;
  clearDraftMentions(): void;

  /** Per-channel draft persistence. */
  readChannelDraft(channelId: string): string;
  saveChannelDraft(channelId: string, text: string): void;
  clearChannelDraft(channelId: string): void;

  /** Inline quote reply state. */
  readQuoteReplyDraft(): { messageId: string; userId: string; preview: string } | null;
  setQuoteReplyDraft(quote: { messageId: string; userId: string; preview: string }): void;
  clearQuoteReplyDraft(): void;
};

/**
 * message-flow 事件处理器对频道未读角标的最小写口。
 */
export type ChannelUnreadProjectionPort = {
  incrementChannelUnread(channelId: string, delta?: number): void;
};
