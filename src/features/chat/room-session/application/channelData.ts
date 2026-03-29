/**
 * @fileoverview 频道数据加载与刷新。
 * @description chat/room-session｜application：频道列表与未读数据刷新。
 */

import type { Ref } from "vue";
import type { ChatUnreadState } from "@/features/chat/domain/types/chatApiModels";
import type { ChatChannel } from "@/features/chat/room-session/contracts";
import type { SessionChannelCatalogApiPort, SessionScopePort } from "./ports";

export type ChannelDataDeps = {
  api: SessionChannelCatalogApiPort;
  scope: SessionScopePort;
  channelsRef: Ref<ChatChannel[]>;
  lastReadTimeMsByChannel: Record<string, number>;
};

export function createChannelData(deps: ChannelDataDeps) {
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
      if (u && Number.isFinite(u.lastReadTime)) deps.lastReadTimeMsByChannel[cid] = u.lastReadTime;
      next.push({
        id: cid,
        name: String(c.name ?? cid).trim() || cid,
        brief: String(c.brief ?? "").trim(),
        unread: u ? Math.max(0, Math.trunc(u.unread)) : 0,
        joined: true,
        joinRequested: false,
      });
    }
    deps.channelsRef.value = next;
  }

  return { refreshChannels };
}
