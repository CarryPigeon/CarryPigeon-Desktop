/**
 * @fileoverview chat session runtime contracts
 * @description
 * 定义 room-session runtime 的状态切片与对外契约。
 */

import type { createChatStoreState } from "@/features/chat/presentation/store/live/chatStoreState";
import type { ChatMessage } from "@/features/chat/message-flow/api-types";
import type { ChannelSelectionOutcome } from "@/features/chat/room-session/api-types";

type ChatStoreState = ReturnType<typeof createChatStoreState>;

export type ChatSessionStateSlice = Pick<
  ChatStoreState,
  | "channelsRef"
  | "currentChannelId"
  | "members"
  | "messagesByChannel"
  | "lastReadTimeMsByChannel"
  | "lastReadMidByChannel"
  | "lastReadReportAtMsByChannel"
  | "nextCursorByChannel"
  | "hasMoreByChannel"
  | "loadingMoreByChannel"
  | "scopeVersion"
  | "messageActionError"
  | "composerDraft"
  | "replyToMessageId"
  | "selectedDomainId"
>;

export type ChatSessionConnectionRuntimePort = {
  ensureChatReady(): Promise<void>;
  teardownConnectionLifecycle(): void;
};

export type ChatSessionRuntimePort = {
  ensureChatReady(): Promise<void>;
  resetForServerChange(): void;
  getMessageById(channelId: string, messageId: string): ChatMessage | null;
  selectChannel(channelId: string): Promise<ChannelSelectionOutcome>;
  reportCurrentReadState(): Promise<void>;
};
