/**
 * @fileoverview 频道治理事件路由器（channels.changed / channel.changed）。
 * @description chat/room-governance｜presentation/store：治理事件同步与局部刷新路由。
 *
 * 职责：
 * - 处理频道范围的结构变化事件（列表变更/频道变更）；
 * - 按 projection 触发最小化补拉，避免过度刷新。
 */

import type { ChatChannelProjection } from "@/features/chat/presentation/events/windowMessageEvents";

/**
 * 频道治理事件路由依赖集合。
 */
export type GovernanceEventRouterDeps = {
  /**
   * 当前选中频道 id（trim 后）。
   */
  getCurrentChannelId: () => string;
  /**
   * 刷新频道列表与未读计数。
   */
  refreshChannels: () => Promise<void>;
  /**
   * 刷新某频道最新页消息（尽力而为）。
   */
  refreshChannelLatestPage: (cid: string) => Promise<void>;
  /**
   * 刷新成员侧栏（尽力而为）。
   */
  refreshMembersRail: (cid: string) => Promise<void>;
  /**
   * 派发窗口级频道投影变化事件（用于同步管理页等）。
   */
  emitChannelProjectionChanged: (cid: string, projection?: ChatChannelProjection) => void;
};

/**
 * 创建频道治理事件路由器。
 *
 * @param deps - 依赖注入。
 * @returns 事件处理函数；已处理返回 true。
 */
export function createGovernanceEventRouter(deps: GovernanceEventRouterDeps) {
  return function routeGovernanceEvent(eventType: string, payload: Record<string, unknown> | null): boolean {
    if (eventType === "channels.changed") {
      void deps.refreshChannels();
      return true;
    }

    if (eventType === "channel.changed") {
      const cid = String(payload?.channelId ?? "").trim();
      const projection = String(payload?.scope ?? "").trim() as ChatChannelProjection | "";

      void deps.refreshChannels();
      if (cid) deps.emitChannelProjectionChanged(cid, projection || undefined);

      if (cid && cid === deps.getCurrentChannelId()) {
        // 最小对齐：按 projection 做局部刷新，避免无差别补拉。
        if (!projection || projection === "messages") void deps.refreshChannelLatestPage(cid);
        if (!projection || projection === "members") void deps.refreshMembersRail(cid);
      }
      return true;
    }

    return false;
  };
}
