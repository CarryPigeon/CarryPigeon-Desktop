/**
 * @fileoverview chat/message-flow 公共类型入口。
 * @description
 * 统一承载 message-flow 子域的稳定公共契约，避免调用方从 `api.ts`
 * 或 `domain/contracts.ts` 混合获取类型。
 */

import type { ReadableCapability } from "@/shared/types/capabilities";
import type { FileAttachment } from "./upload/presentation/runtime/fileAttachmentStore";

import type {
  ChatMessage,
  ChatMessageActionErrorInfo,
  ComposerSubmitPayload,
  DeleteChatMessageOutcome,
  EditChatMessageOutcome,
  MentionCandidate,
  MessageDomain,
  MessageMention,
  MessageReplySummary,
  MessageSearchState,
  ReactToMessageOutcome,
  RecallChatMessageOutcome,
  RemoveReactionOutcome,
  SendChatMessageOutcome,
  ServerMessageSearchResult,
} from "./domain/contracts";

export type {
  ChatMessage,
  ChatMessageActionErrorInfo,
  ComposerSubmitPayload,
  DeleteChatMessageOutcome,
  EditChatMessageOutcome,
  MessageDomain,
  MessageSearchResult,
  MessageSearchState,
  ServerMessageSearchResult,
  SendChatMessageOutcome,
} from "./domain/contracts";

export type { FileAttachment };
export type { MentionCandidate, MessageMention, MessageReactionSummary, MessageReplySummary, ReactToMessageOutcome, RecallChatMessageOutcome, RemoveReactionOutcome } from "./domain/contracts";

/**
 * 当前频道消息时间线快照。
 */
export type MessageTimelineSnapshot = {
  currentMessages: readonly ChatMessage[];
  currentMessageCount: number;
  hasMoreHistory: boolean;
  isLoadingHistory: boolean;
  search: MessageSearchState;
  searchScope: "channel" | "server";
  serverResults: ServerMessageSearchResult[];
  highlightedMessageId: string;
};

/**
 * 当前频道消息时间线 capability。
 *
 * 这里的动作限定在“当前频道上下文”内，避免页面层直接拼装 channelId
 * 去调用跨上下文命令。
 */
export type MessageTimelineCapabilities = ReadableCapability<MessageTimelineSnapshot> & {
  findMessageById(messageId: string): ChatMessage | null;
  loadMoreHistory(): Promise<void>;
  beginReply(messageId: string): void;
  deleteMessage(messageId: string): Promise<DeleteChatMessageOutcome>;
  editMessage(messageId: string, request: { text: string }): Promise<EditChatMessageOutcome>;
  recallMessage(messageId: string): Promise<RecallChatMessageOutcome>;
  reactToMessage(messageId: string, emoji: string): Promise<ReactToMessageOutcome>;
  removeReaction(messageId: string, emoji: string): Promise<RemoveReactionOutcome>;
  searchCurrentChannel(query: string): Promise<void>;
  searchServerMessages(query: string, channelIds?: string[]): Promise<void>;
  loadContextAroundMessage(messageId: string): Promise<void>;
  clearSearch(): void;
};

/**
 * 指定频道消息查询 capability。
 *
 * 只暴露只读查询，避免把任意频道写能力泄漏给调用方。
 */

export type ChannelMessageLookupCapabilities = {
  findMessageById(messageId: string): ChatMessage | null;
};

/**
 * 消息输入框快照。
 */
export type MessageComposerSnapshot = {
  draft: string;
  activeDomainId: string;
  replyToMessageId: string;
  replyDraft: MessageReplySummary | null;
  draftMentions: readonly MessageMention[];
  actionError: ChatMessageActionErrorInfo | null;
  availableDomains: readonly MessageDomain[];
  quoteReplyDraft: { messageId: string; userId: string; preview: string } | null;
};

/**
 * 消息输入框 capability。
 *
 * 聚合草稿编辑、回复上下文与发送动作，页面层无需理解内部 store 字段。
 */
export type MessageComposerCapabilities = ReadableCapability<MessageComposerSnapshot> & {
  setDraft(value: string): void;
  setActiveDomainId(value: string): void;
  setActionError(value: ChatMessageActionErrorInfo | null): void;
  appendAttachmentShareKey(shareKey: string): void;
  cancelReply(): void;
  sendMessage(payload?: ComposerSubmitPayload): Promise<SendChatMessageOutcome>;
  listMentionCandidates(channelId?: string): Promise<MentionCandidate[]>;
  addMention(mention: MessageMention): void;

  /** Image attachment management for paste/drag-drop upload. */
  attachments: readonly FileAttachment[];
  addFiles(files: FileList | File[]): void;
  removeFile(id: string): void;
  clearFiles(): void;

  /** Per-channel draft persistence. */
  readChannelDraft(channelId: string): string;
  saveChannelDraft(channelId: string, text: string): void;
  clearChannelDraft(channelId: string): void;

  /** Inline quote reply. */
  startQuoteReply(messageId: string, userId: string, preview: string): void;
  cancelQuoteReply(): void;
};

/**
 * message-flow 子域对外 capability 聚合。
 */
export type MessageFlowCapabilities = {
  currentChannel: MessageTimelineCapabilities;
  composer: MessageComposerCapabilities;
  forChannel(channelId: string): ChannelMessageLookupCapabilities;
};
