/**
 * @fileoverview room-session 应用层输出端口。
 * @description chat/room-session｜application：面向会话编排的最小依赖契约。
 */

import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { ChatEventsPort } from "@/features/chat/domain/ports/chatEventsPort";
import type { ChatMessage } from "@/features/chat/message-flow/api-types";
import type { ChatMember } from "@/features/chat/room-governance/api-types";
import type { ChatChannel } from "@/features/chat/room-session/domain/contracts";

/**
 * room-session 频道目录读取所需的最小 API 能力。
 */
export type SessionChannelCatalogApiPort = Pick<ChatApiPort, "listChannels" | "getUnreads">;

/**
 * room-session 读状态上报所需的最小 API 能力。
 */
export type SessionReadStateApiPort = Pick<ChatApiPort, "updateReadState">;

/**
 * room-session 管理 WS 连接时所需的事件端口。
 */
export type SessionEventsPort = Pick<ChatEventsPort, "connect">;

/**
 * room-session 用例访问当前 chat runtime 作用域的最小能力。
 */
export type SessionScopePort = {
  getActiveServerSocket(): string;
  getActiveScopeVersion(): number;
  getSocketAndValidToken(): Promise<[string, string]>;
};

/**
 * room-session 频道目录状态端口。
 */
export type SessionDirectoryStatePort = {
  listChannels(): readonly ChatChannel[];
  findChannelById(channelId: string): Readonly<ChatChannel> | null;
  replaceChannels(channels: readonly ChatChannel[]): void;
  readUnreadCount(channelId: string): number;
  markChannelReadLocally(channelId: string): void;
  incrementChannelUnread(channelId: string, delta?: number): void;
  clearChannelDirectory(): void;
};

/**
 * room-session 当前频道状态端口。
 */
export type SessionCurrentChannelStatePort = {
  readCurrentChannelId(): string;
  setCurrentChannelId(channelId: string): void;
  setCurrentChannelIdIfEmpty(): void;
  clearCurrentChannel(): void;
};

/**
 * room-session 消息缓存状态端口。
 */
export type SessionMessageCachePort = {
  listMessages(channelId: string): readonly ChatMessage[];
  findMessageById(channelId: string, messageId: string): ChatMessage | null;
  clearAllMessageCaches(): void;
};

/**
 * room-session 读状态缓存端口。
 */
export type SessionReadMarkerStatePort = {
  readLastReadTimeMs(channelId: string): number;
  writeLastReadTimeMs(channelId: string, timeMs: number): void;
  readLastReadMessageId(channelId: string): string;
  writeLastReadMessageId(channelId: string, messageId: string): void;
  readLastReportAtMs(channelId: string): number;
  writeLastReportAtMs(channelId: string, timeMs: number): void;
  clearAllReadMarkers(): void;
};

/**
 * room-session reset 相关的最小本地状态写口。
 */
export type SessionResetStatePort = {
  clearMembers(): void;
  clearPaginationState(): void;
  clearMessageActionState(): void;
  resetComposerState(): void;
  incrementScopeVersion(): void;
};

/**
 * room-session 成员投影状态端口。
 */
export type SessionMembersStatePort = {
  listMembers(): readonly ChatMember[];
  clearMembers(): void;
};

/**
 * room-session 会话状态组合端口。
 *
 * 说明：
 * - 供 application 用例统一消费；
 * - presentation/runtime 负责把 Vue/ref/reactive 适配为该端口。
 */
export type RoomSessionStatePort =
  & SessionDirectoryStatePort
  & SessionCurrentChannelStatePort
  & SessionMessageCachePort
  & SessionReadMarkerStatePort
  & SessionResetStatePort
  & SessionMembersStatePort;
