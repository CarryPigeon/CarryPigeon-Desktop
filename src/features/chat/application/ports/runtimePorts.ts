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
  /**
   * 这组端口是 chat runtime 对“核心消息域”的最小依赖。
   *
   * 理解方式：
   * - room-session 和 message-flow 共同依赖这里的大部分能力；
   * - governance 子域只依赖 `ChatGovernanceApiPort`。
   */
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
  /**
   * 建立事件流连接，并持续把 envelope 推给上层 runtime。
   */
  connect(
    serverSocket: string,
    accessToken: string,
    onEvent: (evt: ChatEventEnvelope) => void,
    options?: ChatEventsConnectOptions,
  ): ChatEventsClient;
};

export type ChatRuntimeScopePort = {
  /**
   * 读取当前 chat runtime 绑定的 server socket。
   *
   * 说明：
   * - 这是 room-session / message-flow / governance 三个运行时共享的上下文边界。
   */
  getActiveServerSocket(): string;
  /**
   * 读取当前作用域版本号。
   *
   * 用途：
   * - 当切服或重置发生时递增；
   * - 让异步请求在返回时能判断自己是否已过期。
   */
  getActiveScopeVersion(): number;
  /**
   * 读取当前 socket 与可用 token。
   *
   * 约定：
   * - 若 socket/token 不可用，返回空字符串；
   * - 由上层动作决定如何把“缺失权限”映射为 outcome。
   */
  getSocketAndValidToken(): Promise<[string, string]>;
};

export type ChatReadStateReporterPort = {
  /**
   * 这组接口定义“本地读时间推进 + 限流上报”的标准协议。
   *
   * 谁会用它：
   * - room-session 的频道切换
   * - signal viewport 的滚动到底行为
   * - composer 发送成功后的本地读进度推进
   */
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
