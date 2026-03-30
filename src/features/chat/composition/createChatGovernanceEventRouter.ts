/**
 * @fileoverview chat 治理事件路由器（channels.changed / channel.changed）。
 * @description
 * chat 根运行时中的治理集成事件路由。
 *
 * 职责：
 * - 处理频道范围的结构变化事件（列表变更 / 频道变更）；
 * - 按 projection 触发最小化补拉，避免无差别刷新；
 * - 作为 chat 根运行时集成层的一部分，而不是治理页面 UI store。
 */

import type { ChatChannelProjection } from "@/features/chat/presentation/shared/windowMessageEvents";

/**
 * chat 治理事件路由器依赖。
 */
export type ChatGovernanceEventRouterDeps = {
  getCurrentChannelId: () => string;
  refreshChannels: () => Promise<void>;
  refreshChannelLatestPage: (cid: string) => Promise<void>;
  refreshMembersRail: (cid: string) => Promise<void>;
  emitChannelProjectionChanged: (cid: string, projection?: ChatChannelProjection) => void;
};

/**
 * 创建 chat 根运行时的治理事件路由器。
 *
 * @param deps - 依赖注入。
 * @returns 事件处理函数；已处理返回 true。
 */
export function createChatGovernanceEventRouter(deps: ChatGovernanceEventRouterDeps) {
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
        if (!projection || projection === "messages") void deps.refreshChannelLatestPage(cid);
        if (!projection || projection === "members") void deps.refreshMembersRail(cid);
      }
      return true;
    }

    return false;
  };
}
