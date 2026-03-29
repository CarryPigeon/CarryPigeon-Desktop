/**
 * @fileoverview room-session 应用层输出端口。
 * @description chat/room-session｜application：面向会话编排的最小依赖契约。
 */

import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { ChatEventsPort } from "@/features/chat/domain/ports/chatEventsPort";

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
