/**
 * @fileoverview chat 共享运行时端口。
 * @description
 * 定义 chat 各 application 子模块共享的最小输出端口：
 * - HTTP API 访问；
 * - WS 事件连接；
 * - 当前运行时 scope 访问。
 */

import type { ChatEventsClient, ChatEventsConnectOptions } from "@/features/chat/domain/types/chatEventModels";
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

/**
 * chat 核心消息域 API 端口。
 */
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

/**
 * chat 治理域 API 端口。
 */
export type ChatGovernanceApiPort = {
  /**
   * 查询频道成员。
   */
  listChannelMembers(serverSocket: string, accessToken: string, channelId: string): Promise<ChatChannelMemberRecord[]>;
  /**
   * 移除频道成员。
   */
  kickChannelMember(serverSocket: string, accessToken: string, channelId: string, uid: string): Promise<void>;
  /**
   * 授予管理员。
   */
  addChannelAdmin(serverSocket: string, accessToken: string, channelId: string, uid: string): Promise<void>;
  /**
   * 撤销管理员。
   */
  removeChannelAdmin(serverSocket: string, accessToken: string, channelId: string, uid: string): Promise<void>;
  /**
   * 查询申请列表。
   */
  listChannelApplications(
    serverSocket: string,
    accessToken: string,
    channelId: string,
  ): Promise<ChatChannelApplicationRecord[]>;
  /**
   * 审批申请。
   */
  decideChannelApplication(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    applicationId: string,
    decision: "approve" | "reject",
  ): Promise<void>;
  /**
   * 查询封禁列表。
   */
  listChannelBans(serverSocket: string, accessToken: string, channelId: string): Promise<ChatChannelBanRecord[]>;
  /**
   * 设置封禁。
   */
  putChannelBan(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    uid: string,
    until: number,
    reason: string,
  ): Promise<void>;
  /**
   * 删除封禁。
   */
  deleteChannelBan(serverSocket: string, accessToken: string, channelId: string, uid: string): Promise<void>;
  /**
   * 创建频道。
   */
  createChannel(
    serverSocket: string,
    accessToken: string,
    req: ChatChannelCreateInput,
  ): Promise<ChatChannelRecord>;
  /**
   * 删除频道。
   */
  deleteChannel(serverSocket: string, accessToken: string, channelId: string): Promise<void>;
};

/**
 * chat 根层完整 API 端口。
 *
 * 它是 core 与 governance 两个分组端口的并集，只应在 root assembly 或 root gateway 层使用。
 */
export type ChatApiPort = ChatCoreApiPort & ChatGovernanceApiPort;

/**
 * chat 根层事件流端口。
 */
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

/**
 * chat 根层 runtime scope 端口。
 */
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

/**
 * chat 根层读状态上报协作端口。
 */
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
