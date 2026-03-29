/**
 * @fileoverview 频道数据加载与刷新。
 * @description chat/room-session｜application：频道列表与未读数据刷新。
 */

import type { ChatUnreadState } from "@/features/chat/domain/types/chatApiModels";
import type { ChatChannel } from "@/features/chat/room-session/domain/contracts";
import type {
  SessionChannelCatalogApiPort,
  SessionDirectoryStatePort,
  SessionReadMarkerStatePort,
  SessionScopePort,
} from "../ports/sessionPorts";

export type ChannelDataDeps = {
  /**
   * 频道目录刷新所需的最小依赖：
   * - 频道列表 API
   * - 未读摘要 API
   * - 当前 scope
   * - 本地目录状态
   */
  api: SessionChannelCatalogApiPort;
  scope: SessionScopePort;
  directoryState: SessionDirectoryStatePort;
  readMarkerState: SessionReadMarkerStatePort;
};

export function createChannelData(deps: ChannelDataDeps) {
  /**
   * 重取频道目录并把未读摘要折叠进本地 `ChatChannel[]`。
   *
   * 说明：
   * - room-session 对外只维护“加入的频道目录”；
   * - unread 和 lastReadTime 也在这里同步写回本地状态。
   */
  async function refreshChannels(): Promise<void> {
    const [socket, token] = await deps.scope.getSocketAndValidToken();
    if (!socket || !token) return;
    const requestSocket = socket;
    const requestScopeVersion = deps.scope.getActiveScopeVersion();

    const list = await deps.api.listChannels(socket, token);
    const unreads = await deps.api.getUnreads(socket, token).catch(() => [] as ChatUnreadState[]);
    if (deps.scope.getActiveServerSocket() !== requestSocket) return;
    if (deps.scope.getActiveScopeVersion() !== requestScopeVersion) return;
    const unreadByCid: Record<string, { unread: number; lastReadTime: number }> = {};
    for (const x of unreads) {
      unreadByCid[String(x.channelId ?? "").trim()] = {
        unread: Number(x.unreadCount ?? 0),
        lastReadTime: Number(x.lastReadTime ?? 0),
      };
    }

    const next: ChatChannel[] = [];
    for (const c of list) {
      const cid = String(c.id ?? "").trim();
      if (!cid) continue;
      const u = unreadByCid[cid];
      if (u && Number.isFinite(u.lastReadTime)) deps.readMarkerState.writeLastReadTimeMs(cid, u.lastReadTime);
      next.push({
        id: cid,
        name: String(c.name ?? cid).trim() || cid,
        brief: String(c.brief ?? "").trim(),
        unread: u ? Math.max(0, Math.trunc(u.unread)) : 0,
        joined: true,
        joinRequested: false,
      });
    }
    deps.directoryState.replaceChannels(next);
  }

  return { refreshChannels };
}
