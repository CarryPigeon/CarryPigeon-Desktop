/**
 * @fileoverview chatApiPort.ts
 * @description chat｜领域端口：chatApiPort。
 *
 * 说明：
 * - 该端口刻意保持“协议无关”：可由 HTTP 实现、内存 Mock 实现，或通过原生桥接实现。
 * - transport wire / snake_case 字段必须在 data 层被吸收，不得穿透到该端口。
 * - 该端口用于 chat feature 内部（domain/usecase/di/data）依赖倒置；跨 feature 请使用 `@/features/chat/api`。
 */

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
} from "../types/chatApiModels";

/**
 * 聊天 HTTP API 端口（domain 层）。
 *
 * 说明：
 * - 该端口描述“请求-响应”类能力（与事件流 `ChatEventsPort` 相对）；
 * - 具体实现位于 data 层（HTTP/Mock/原生桥接等）。
 */
export type ChatApiPort = {
  listChannels(serverSocket: string, accessToken: string): Promise<ChatChannelRecord[]>;
  getUnreads(serverSocket: string, accessToken: string): Promise<ChatUnreadState[]>;
  listChannelMessages(
    serverSocket: string,
    accessToken: string,
    cid: string,
    cursor?: string,
    limit?: number,
  ): Promise<ChatMessagePage>;
  sendChannelMessage(
    serverSocket: string,
    accessToken: string,
    cid: string,
    req: ChatSendMessageInput,
    idempotencyKey?: string,
  ): Promise<ChatMessageRecord>;
  deleteMessage(serverSocket: string, accessToken: string, mid: string): Promise<void>;
  updateReadState(serverSocket: string, accessToken: string, cid: string, req: ChatReadStateInput): Promise<void>;
  applyJoinChannel(serverSocket: string, accessToken: string, cid: string, reason: string): Promise<void>;
  patchChannel(
    serverSocket: string,
    accessToken: string,
    cid: string,
    patch: ChatChannelPatchInput,
  ): Promise<ChatChannelRecord>;
  listChannelMembers(serverSocket: string, accessToken: string, cid: string): Promise<ChatChannelMemberRecord[]>;
  kickChannelMember(serverSocket: string, accessToken: string, cid: string, uid: string): Promise<void>;
  addChannelAdmin(serverSocket: string, accessToken: string, cid: string, uid: string): Promise<void>;
  removeChannelAdmin(serverSocket: string, accessToken: string, cid: string, uid: string): Promise<void>;
  listChannelApplications(serverSocket: string, accessToken: string, cid: string): Promise<ChatChannelApplicationRecord[]>;
  decideChannelApplication(
    serverSocket: string,
    accessToken: string,
    cid: string,
    applicationId: string,
    decision: "approve" | "reject",
  ): Promise<void>;
  listChannelBans(serverSocket: string, accessToken: string, cid: string): Promise<ChatChannelBanRecord[]>;
  putChannelBan(
    serverSocket: string,
    accessToken: string,
    cid: string,
    uid: string,
    until: number,
    reason: string,
  ): Promise<void>;
  deleteChannelBan(serverSocket: string, accessToken: string, cid: string, uid: string): Promise<void>;
  createChannel(serverSocket: string, accessToken: string, req: ChatChannelCreateInput): Promise<ChatChannelRecord>;
  deleteChannel(serverSocket: string, accessToken: string, cid: string): Promise<void>;
};
