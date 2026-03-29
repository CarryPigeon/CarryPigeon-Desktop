/**
 * @fileoverview chat/message-flow 公共类型入口。
 * @description
 * 统一承载 message-flow 子域的稳定公共契约，避免调用方从 `api.ts`
 * 或 `domain/contracts.ts` 混合获取类型。
 */

import type { ReadableCapability } from "@/shared/types/capabilities";
import type {
  ChatMessage,
  ChatMessageActionErrorInfo,
  ComposerSubmitPayload,
  DeleteChatMessageOutcome,
  MessageDomain,
  SendChatMessageOutcome,
} from "./domain/contracts";

export type {
  ChatMessage,
  ChatMessageActionErrorInfo,
  ComposerSubmitPayload,
  DeleteChatMessageOutcome,
  MessageDomain,
  SendChatMessageOutcome,
} from "./domain/contracts";

export type MessageTimelineSnapshot = {
  currentMessages: readonly ChatMessage[];
  currentMessageCount: number;
  hasMoreHistory: boolean;
  isLoadingHistory: boolean;
};

export type MessageTimelineCapabilities = ReadableCapability<MessageTimelineSnapshot> & {
  findMessageById(messageId: string): ChatMessage | null;
  loadMoreHistory(): Promise<void>;
  beginReply(messageId: string): void;
  deleteMessage(messageId: string): Promise<DeleteChatMessageOutcome>;
};

export type ChannelMessageLookupCapabilities = {
  findMessageById(messageId: string): ChatMessage | null;
};

export type MessageComposerSnapshot = {
  draft: string;
  activeDomainId: string;
  replyToMessageId: string;
  actionError: ChatMessageActionErrorInfo | null;
  availableDomains: readonly MessageDomain[];
};

export type MessageComposerCapabilities = ReadableCapability<MessageComposerSnapshot> & {
  setDraft(value: string): void;
  setActiveDomainId(value: string): void;
  setActionError(value: ChatMessageActionErrorInfo | null): void;
  appendAttachmentShareKey(shareKey: string): void;
  cancelReply(): void;
  sendMessage(payload?: ComposerSubmitPayload): Promise<SendChatMessageOutcome>;
};

export type MessageFlowCapabilities = {
  currentChannel: MessageTimelineCapabilities;
  composer: MessageComposerCapabilities;
  forChannel(channelId: string): ChannelMessageLookupCapabilities;
};
