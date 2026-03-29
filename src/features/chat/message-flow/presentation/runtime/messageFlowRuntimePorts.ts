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
import type { createChatStoreState } from "@/features/chat/presentation/store/live/chatStoreState";

type ChatStoreState = ReturnType<typeof createChatStoreState>;

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

export type ChatMessageTimelinePort = {
  loadChannelMessages(channelId: string): Promise<void>;
  refreshChannelLatestPage(channelId: string): Promise<void>;
  mapWireMessage(serverSocket: string, message: ChatMessageRecord): ChatMessage;
  compareMessages(a: ChatMessage, b: ChatMessage): number;
};

export type ChatMessageFlowRuntimePort = ChatMessageTimelinePort & {
  availableDomains(): MessageDomain[];
  loadMoreMessages(): Promise<void>;
  deleteMessage(messageId: string): Promise<DeleteChatMessageOutcome>;
  startReply(messageId: string): void;
  cancelReply(): void;
  sendComposerMessage(payload?: ComposerSubmitPayload): Promise<SendChatMessageOutcome>;
};
