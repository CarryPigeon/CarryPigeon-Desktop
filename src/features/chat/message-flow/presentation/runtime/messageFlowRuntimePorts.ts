/**
 * @fileoverview chat message-flow runtime contracts
 * @description
 * 定义 message-flow runtime 的状态切片与对外契约。
 */

import type { ChatMessageRecord } from "@/features/chat/domain/types/chatApiModels";
import type {
  ChatMessage,
  ComposerSubmitPayload,
  DeleteChatMessageOutcome,
  MessageDomain,
  SendChatMessageOutcome,
} from "@/features/chat/message-flow/api-types";
import type { createChatStoreState } from "@/features/chat/composition/store/createChatStoreState";

type ChatStoreState = ReturnType<typeof createChatStoreState>;

/**
 * message-flow runtime 关心的根 store 状态切片。
 */
export type ChatMessageFlowStateSlice = Pick<
  ChatStoreState,
  | "currentChannelId"
  | "messagesByChannel"
  | "nextCursorByChannel"
  | "hasMoreByChannel"
  | "loadingMoreByChannel"
  | "selectedDomainId"
  | "composerDraft"
  | "replyToMessageId"
  | "messageActionError"
>;

/**
 * message-flow 时间线运行时端口。
 */
export type ChatMessageTimelinePort = {
  loadChannelMessages(channelId: string): Promise<void>;
  refreshChannelLatestPage(channelId: string): Promise<void>;
  mapWireMessage(serverSocket: string, message: ChatMessageRecord): ChatMessage;
  compareMessages(a: ChatMessage, b: ChatMessage): number;
};

/**
 * message-flow runtime 对外端口。
 */
export type ChatMessageFlowRuntimePort = ChatMessageTimelinePort & {
  availableDomains(): MessageDomain[];
  loadMoreMessages(): Promise<void>;
  deleteMessage(messageId: string): Promise<DeleteChatMessageOutcome>;
  startReply(messageId: string): void;
  cancelReply(): void;
  sendComposerMessage(payload?: ComposerSubmitPayload): Promise<SendChatMessageOutcome>;
};
