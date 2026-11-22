/**
 * @fileoverview 会话读状态事件路由器（read_state.updated）。
 * @description chat/room-session｜application：read_state.updated 事件路由器。
 */

import { compareMessageIdForReadOrder } from "@/features/chat/domain/utils/readMarker";
import type { RoomSessionStatePort } from "../ports";

/**
 * 已读状态事件路由器依赖。
 */
export type ReadStateEventRouterDeps = {
  getCurrentUserId: () => string;
  state: Pick<
    RoomSessionStatePort,
    | "readLastReadMessageId"
    | "writeLastReadMessageId"
  >;
  refreshChannelReadState: (cid: string) => void;
};

/**
 * 创建已读状态事件路由器。
 *
 * 该路由器只接受当前用户自己的 `read_state.updated` 事件，并在本地读标记
 * 单调推进时更新 room-session 状态。
 */
export function createReadStateEventRouter(deps: ReadStateEventRouterDeps) {
  return function routeReadStateEvent(eventType: string, payload: Record<string, unknown> | null): boolean {
    if (eventType !== "read_state.updated") return false;

    const cid = String(payload?.channelId ?? "").trim();
    const uid = String(payload?.userId ?? "").trim();
    const lastReadMid = String(payload?.lastReadMessageId ?? "").trim();
    if (!cid || !uid || !lastReadMid || uid !== deps.getCurrentUserId()) return true;
    const prevReadMid = deps.state.readLastReadMessageId(cid);
    const comparison = compareMessageIdForReadOrder(lastReadMid, prevReadMid);
    if (comparison < 0) return true;
    if (comparison > 0) deps.state.writeLastReadMessageId(cid, lastReadMid);
    deps.refreshChannelReadState(cid);
    return true;
  };
}
