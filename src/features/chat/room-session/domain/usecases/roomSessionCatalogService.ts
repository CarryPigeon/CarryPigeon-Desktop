/**
 * @fileoverview room-session 目录 application service。
 * @description
 * 统一封装频道目录与未读摘要刷新。
 *
 * 它只负责“目录快照怎么从远端同步到本地投影”，
 * 不承担频道切换、连接恢复、读状态上报等其他会话职责。
 */

import type { ChatUnreadState } from "@/features/chat/domain/types/chatApiModels";
import type { ChatChannel } from "@/features/chat/room-session/domain/contracts";
import type {
  SessionChannelCatalogApiPort,
  SessionDirectoryStatePort,
  SessionReadMarkerStatePort,
  SessionScopePort,
} from "../ports";

/**
 * `RoomSessionCatalogApplicationService` 的依赖集合。
 */
export type RoomSessionCatalogApplicationServiceDeps = {
  api: SessionChannelCatalogApiPort;
  scope: SessionScopePort;
  directoryState: SessionDirectoryStatePort;
  readMarkerState: SessionReadMarkerStatePort;
};

/**
 * room-session 子域中负责“目录刷新”的 application service。
 */
export class RoomSessionCatalogApplicationService {
  constructor(private readonly deps: RoomSessionCatalogApplicationServiceDeps) {}

  /**
   * 从远端重取频道目录与未读摘要，并写回本地目录投影。
   *
   * 写回内容包括：
   * - 频道基础信息
   * - unread 角标
   * - lastReadTime 基线
   */
  async refreshChannels(): Promise<void> {
    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    if (!socket || !token) return;
    const requestSocket = socket;
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();

    const list = await this.deps.api.listChannels(socket, token);
    const unreads = await this.deps.api.getUnreads(socket, token).catch(() => [] as ChatUnreadState[]);
    if (this.isScopeStale(requestSocket, requestScopeVersion)) return;

    const unreadByCid: Record<string, { unread: number; lastReadTime: number }> = {};
    for (const unread of unreads) {
      unreadByCid[String(unread.channelId ?? "").trim()] = {
        unread: Number(unread.unreadCount ?? 0),
        lastReadTime: Number(unread.lastReadTime ?? 0),
      };
    }

    const next: ChatChannel[] = [];
    for (const channel of list) {
      const cid = String(channel.id ?? "").trim();
      if (!cid) continue;
      const unread = unreadByCid[cid];
      if (unread && Number.isFinite(unread.lastReadTime)) {
        this.deps.readMarkerState.writeLastReadTimeMs(cid, unread.lastReadTime);
      }
      next.push({
        id: cid,
        name: String(channel.name ?? cid).trim() || cid,
        brief: String(channel.brief ?? "").trim(),
        unread: unread ? Math.max(0, Math.trunc(unread.unread)) : 0,
        joined: true,
        joinRequested: false,
      });
    }
    this.deps.directoryState.replaceChannels(next);
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
