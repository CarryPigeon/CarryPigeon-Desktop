/**
 * @fileoverview liveChat 频道数据加载与刷新。
 * @description chat｜展示层（store 子模块）：liveChatChannelData。
 *
 * 职责：
 * - 拉取频道列表与未读信息，并映射为 UI 侧使用的 `ChatChannel`。
 * - 维护 `lastReadTimeMsByChannel` 的本地镜像（用于读状态单调推进与上报节流）。
 *
 * 非目标：
 * - 不负责“当前频道选择/消息分页/WS 管理”等逻辑；这些由其它子模块协同完成。
 */

import type { Ref } from "vue";
import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { UnreadItemDto } from "@/features/chat/domain/types/chatWireDtos";
import type { ChatChannel } from "../chatStoreTypes";

/**
 * 频道数据刷新器的依赖集合。
 */
export type LiveChatChannelDataDeps = {
  /**
   * chat API 端口（HTTP）。
   */
  api: ChatApiPort;
  /**
   * 获取当前 server socket 与可用 access token（均已 trim）。
   */
  getSocketAndValidToken: () => Promise<[string, string]>;
  /**
   * 频道列表的可变引用（将被 `refreshChannels` 写入）。
   */
  channelsRef: Ref<ChatChannel[]>;
  /**
   * channelId → last_read_time（毫秒）映射（将被刷新与更新）。
   */
  lastReadTimeMsByChannel: Record<string, number>;
};

/**
 * 创建“频道数据刷新”能力。
 *
 * @param deps - 依赖集合。
 * @returns 频道数据相关方法集合。
 */
export function createLiveChatChannelData(deps: LiveChatChannelDataDeps) {
  /**
   * 从服务端刷新频道列表 + 未读数据。
   *
   * @returns Promise<void>。
   */
  async function refreshChannels(): Promise<void> {
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) return;

    const list = await deps.api.listChannels(socket, token);
    const unreads = await deps.api.getUnreads(socket, token).catch(() => [] as UnreadItemDto[]);
    const unreadByCid: Record<string, { unread: number; lastReadTime: number }> = {};
    for (const x of unreads) {
      unreadByCid[String(x.cid ?? "").trim()] = {
        unread: Number(x.unread_count ?? 0),
        lastReadTime: Number(x.last_read_time ?? 0),
      };
    }

    const next: ChatChannel[] = [];
    for (const c of list) {
      const cid = String(c.cid ?? "").trim();
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
