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

/**
 * 当前频道消息时间线快照。
 */
export type MessageTimelineSnapshot = {
  currentMessages: readonly ChatMessage[];
  currentMessageCount: number;
  hasMoreHistory: boolean;
  isLoadingHistory: boolean;
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
  actionError: ChatMessageActionErrorInfo | null;
  availableDomains: readonly MessageDomain[];
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
};

/**
 * message-flow 子域对外 capability 聚合。
 */
export type MessageFlowCapabilities = {
  currentChannel: MessageTimelineCapabilities;
  composer: MessageComposerCapabilities;
  forChannel(channelId: string): ChannelMessageLookupCapabilities;
};
