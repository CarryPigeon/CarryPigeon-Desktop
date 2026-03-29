/**
 * @fileoverview chat 共享运行时端口。
 * @description
 * 定义 chat 各 application 子模块共享的最小输出端口：
 * - HTTP API 访问；
 * - WS 事件连接；
 * - 当前运行时 scope 访问。
 */

import type { ChatEventsClient, ChatEventsConnectOptions } from "@/features/chat/domain/ports/chatEventsPort";
import type {
  ChatChannelApplicationRecord,
  ChatChannelBanRecord,
  ChatChannelCreateInput,
  ChatChannelMemberRecord,
  ChatChannelPatchInput,
  ChatChannelRecord,
  ChatMessagePage,
  ChatMessageRecord,
  ChatReadStateInput,
  ChatSendMessageInput,
  ChatUnreadState,
} from "@/features/chat/domain/types/chatApiModels";
import type { ChatEventEnvelope } from "@/features/chat/domain/types/chatEventModels";

export type ChatCoreApiPort = {
  listChannels(serverSocket: string, accessToken: string): Promise<ChatChannelRecord[]>;
  getUnreads(serverSocket: string, accessToken: string): Promise<ChatUnreadState[]>;
  listChannelMessages(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    cursor?: string,
    limit?: number,
  ): Promise<ChatMessagePage>;
  sendChannelMessage(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    req: ChatSendMessageInput,
    idempotencyKey?: string,
  ): Promise<ChatMessageRecord>;
  deleteMessage(serverSocket: string, accessToken: string, messageId: string): Promise<void>;
  updateReadState(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    readState: ChatReadStateInput,
  ): Promise<void>;
  applyJoinChannel(serverSocket: string, accessToken: string, channelId: string, reason: string): Promise<void>;
  patchChannel(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    patch: ChatChannelPatchInput,
  ): Promise<ChatChannelRecord>;
};

export type ChatGovernanceApiPort = {
  listChannelMembers(serverSocket: string, accessToken: string, channelId: string): Promise<ChatChannelMemberRecord[]>;
  kickChannelMember(serverSocket: string, accessToken: string, channelId: string, uid: string): Promise<void>;
  addChannelAdmin(serverSocket: string, accessToken: string, channelId: string, uid: string): Promise<void>;
  removeChannelAdmin(serverSocket: string, accessToken: string, channelId: string, uid: string): Promise<void>;
  listChannelApplications(
    serverSocket: string,
    accessToken: string,
    channelId: string,
  ): Promise<ChatChannelApplicationRecord[]>;
  decideChannelApplication(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    applicationId: string,
    decision: "approve" | "reject",
  ): Promise<void>;
  listChannelBans(serverSocket: string, accessToken: string, channelId: string): Promise<ChatChannelBanRecord[]>;
  putChannelBan(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    uid: string,
    until: number,
    reason: string,
  ): Promise<void>;
  deleteChannelBan(serverSocket: string, accessToken: string, channelId: string, uid: string): Promise<void>;
  createChannel(
    serverSocket: string,
    accessToken: string,
    req: ChatChannelCreateInput,
  ): Promise<ChatChannelRecord>;
  deleteChannel(serverSocket: string, accessToken: string, channelId: string): Promise<void>;
};

export type ChatApiPort = ChatCoreApiPort & ChatGovernanceApiPort;

export type ChatEventsPort = {
  connect(
    serverSocket: string,
    accessToken: string,
    onEvent: (evt: ChatEventEnvelope) => void,
    options?: ChatEventsConnectOptions,
  ): ChatEventsClient;
};

export type ChatRuntimeScopePort = {
  getActiveServerSocket(): string;
  getActiveScopeVersion(): number;
  getSocketAndValidToken(): Promise<[string, string]>;
};

export type ChatReadStateReporterPort = {
  advanceLocalReadTime(cid: string, nowMs: number): number;
  canReportNow(cid: string, nowMs: number, minIntervalMs?: number): boolean;
  reportIfAllowed(
    cid: string,
    lastReadMid: string,
    lastReadTimeMs: number,
    nowMs: number,
    minIntervalMs?: number,
  ): Promise<boolean>;
};
