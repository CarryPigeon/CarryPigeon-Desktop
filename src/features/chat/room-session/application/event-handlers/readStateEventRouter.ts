/**
 * @fileoverview 会话读状态事件路由器（read_state.updated）。
 * @description chat/room-session｜application：read_state.updated 事件路由器。
 */

import { shouldAdvanceReadMarker } from "@/features/chat/domain/utils/readMarker";
import type { RoomSessionStatePort } from "../ports/sessionPorts";

export type ReadStateEventRouterDeps = {
  getCurrentUserId: () => string;
  state: Pick<
    RoomSessionStatePort,
    | "readLastReadTimeMs"
    | "readLastReadMessageId"
    | "writeLastReadTimeMs"
    | "writeLastReadMessageId"
    | "markChannelReadLocally"
  >;
};

export function createReadStateEventRouter(deps: ReadStateEventRouterDeps) {
  return function routeReadStateEvent(eventType: string, payload: Record<string, unknown> | null): boolean {
    if (eventType !== "read_state.updated") return false;

    const cid = String(payload?.channelId ?? "").trim();
    const uid = String(payload?.userId ?? "").trim();
    const lastReadMid = String(payload?.lastReadMessageId ?? "").trim();
    const t = Number(payload?.lastReadTime ?? 0);
    if (!cid || !uid || !Number.isFinite(t)) return true;

    if (uid !== deps.getCurrentUserId()) return true;
    const nextTime = Math.trunc(t);
    const prevReadTime = deps.state.readLastReadTimeMs(cid);
    const prevReadMid = deps.state.readLastReadMessageId(cid);
    if (!shouldAdvanceReadMarker(prevReadTime, prevReadMid, nextTime, lastReadMid)) return true;
    deps.state.writeLastReadTimeMs(cid, nextTime);
    if (lastReadMid) deps.state.writeLastReadMessageId(cid, lastReadMid);
    deps.state.markChannelReadLocally(cid);
    return true;
  };
}
