/**
 * @fileoverview 会话读状态事件路由器（read_state.updated）。
 * @description chat/room-session｜application：read_state.updated 事件路由器。
 */

import type { Ref } from "vue";
import { shouldAdvanceReadMarker } from "@/features/chat/domain/utils/readMarker";
import type { ChatChannel } from "@/features/chat/room-session/contracts";

export type ReadStateEventRouterDeps = {
  getCurrentUserId: () => string;
  channelsRef: Ref<ChatChannel[]>;
  lastReadTimeMsByChannel: Record<string, number>;
  lastReadMidByChannel: Record<string, string>;
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
    const prevReadTime = Number(deps.lastReadTimeMsByChannel[cid] ?? 0);
    const prevReadMid = String(deps.lastReadMidByChannel[cid] ?? "");
    if (!shouldAdvanceReadMarker(prevReadTime, prevReadMid, nextTime, lastReadMid)) return true;
    deps.lastReadTimeMsByChannel[cid] = nextTime;
    if (lastReadMid) deps.lastReadMidByChannel[cid] = lastReadMid;
    const ch = deps.channelsRef.value.find((x) => x.id === cid);
    if (ch) ch.unread = 0;
    return true;
  };
}
