/**
 * @fileoverview room-session 目录 application service。
 * @description
 * 统一封装频道目录与未读摘要刷新。
 *
 * 它只负责“目录快照怎么从远端同步到本地投影”，
 * 不承担频道切换、连接恢复、读状态上报等其他会话职责。
 */

import type { ChatChannel } from "@/features/chat/room-session/domain/contracts";
import type {
  SessionChannelCatalogApiPort,
  SessionDirectoryStatePort,
  SessionReadMarkerStatePort,
  SessionScopePort,
} from "../ports";
import { compareMessageIdForReadOrder } from "@/features/chat/domain/utils/readMarker";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("room-session-catalog");

/**
 * `RoomSessionCatalogApplicationService` 的依赖集合。
 */
export type RoomSessionCatalogApplicationServiceDeps = {
  api: SessionChannelCatalogApiPort;
  scope: SessionScopePort;
  directoryState: Pick<SessionDirectoryStatePort, "listChannels" | "replaceChannels" | "readUnreadCount" | "incrementChannelUnread">;
  readMarkerState: Pick<SessionReadMarkerStatePort, "readLastReadMessageId" | "writeLastReadMessageId">;
};

/**
 * room-session 子域中负责“目录刷新”的 application service。
 */
export class RoomSessionCatalogApplicationService {
  private readonly readRequests = new Map<string, symbol>();

  constructor(private readonly deps: RoomSessionCatalogApplicationServiceDeps) {}

  /**
   * 从远端重取频道目录与未读摘要，并写回本地目录投影。
   *
   * 写回内容包括：
   * - 频道基础信息
   * - 服务端未读角标
   */
  async refreshChannels(): Promise<void> {
    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    if (!socket || !token) return;
    const requestSocket = socket;
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();

    const list = await this.deps.api.listChannels(socket, token);
    const unreads = await this.deps.api.getUnreads(socket, token).catch((error) => {
      logger.warn("Action: chat_room_session_unreads_fetch_failed", { error: String(error) });
      return undefined;
    });
    if (this.isScopeStale(requestSocket, requestScopeVersion)) return;

    const unreadByCid = new Map(unreads?.map((entry) => [entry.channelId, entry.unreadCount]));
    const previousByCid = new Map(this.deps.directoryState.listChannels().map((entry) => [entry.id, entry.unread]));

    const next: ChatChannel[] = [];
    for (const channel of list) {
      const cid = String(channel.id ?? "").trim();
      if (!cid) continue;
      const displayUnread = (unreads ? unreadByCid.get(cid) : previousByCid.get(cid)) ?? 0;
      next.push({
        id: cid,
        name: String(channel.name ?? cid).trim() || cid,
        brief: String(channel.brief ?? "").trim(),
        unread: displayUnread,
        joined: true,
        joinRequested: false,
        channelType: channel.systemChannel ? "system" : channel.type,
        categoryId: channel.categoryId ? String(channel.categoryId).trim() : undefined,
        categoryName: channel.categoryName ? String(channel.categoryName).trim() : undefined,
        order: Number.isFinite(channel.order) ? Math.trunc(channel.order as number) : undefined,
      });
    }
    this.deps.directoryState.replaceChannels(next);
  }

  /** 同步某频道的服务端已读锚点和权威未读数。 */
  async refreshChannelReadState(cid: string): Promise<void> {
    const version = this.deps.scope.getActiveScopeVersion();
    const request = Symbol();
    this.readRequests.set(cid, request);
    try {
      const [socket, token] = await this.deps.scope.getSocketAndValidToken();
      if (!socket || !token || this.isScopeStale(socket, version)) return;
      const state = await this.deps.api.getChannelReadState(socket, token, cid);
      if (this.isScopeStale(socket, version) || this.readRequests.get(cid) !== request) return;
      const mid = state.lastReadMid ?? "";
      const previous = this.deps.readMarkerState.readLastReadMessageId(cid);
      if (compareMessageIdForReadOrder(mid, previous) < 0) return;
      if (mid) this.deps.readMarkerState.writeLastReadMessageId(cid, mid);
      const existing = this.deps.directoryState.readUnreadCount(cid);
      this.deps.directoryState.incrementChannelUnread(cid, state.unreadCount - existing);
    } catch (error) {
      logger.warn("Action: chat_room_session_read_state_fetch_failed", { channelId: cid, error: String(error) });
    } finally {
      if (this.readRequests.get(cid) === request) this.readRequests.delete(cid);
    }
  }

  /**
   * 校验目录请求返回后当前作用域是否仍有效。
   */
  private isScopeStale(requestSocket: string, requestScopeVersion: number): boolean {
    return (
      this.deps.scope.getActiveServerSocket() !== requestSocket ||
      this.deps.scope.getActiveScopeVersion() !== requestScopeVersion
    );
  }
}
