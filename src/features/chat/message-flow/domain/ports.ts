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
} from "@/features/chat/message-flow/domain/contracts";

/**
 * message-flow 应用层所需的最小 API 能力。
 */
export type MessageFlowApiPort = Pick<
  ChatApiPort,
  "sendChannelMessage" | "deleteMessage" | "listChannelMessages"
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
  readNextCursor(channelId: string): string;
  writeNextCursor(channelId: string, nextCursor: string): void;
  readHasMore(channelId: string): boolean;
  writeHasMore(channelId: string, hasMore: boolean): void;
  isLoadingMore(channelId: string): boolean;
  setLoadingMore(channelId: string, loading: boolean): void;
};

/**
 * message-flow composer 状态端口。
 */
export type MessageComposerStatePort = {
  readSelectedDomainId(): string;
  readDraft(): string;
  replaceDraft(value: string): void;
  clearDraft(): void;
  readReplyToMessageId(): string;
  setReplyToMessageId(messageId: string): void;
  clearReplyToMessageId(): void;
  writeActionError(error: ChatMessageActionErrorInfo | null): void;
};

/**
 * message-flow 事件处理器对频道未读角标的最小写口。
 */
export type ChannelUnreadProjectionPort = {
  incrementChannelUnread(channelId: string, delta?: number): void;
};
