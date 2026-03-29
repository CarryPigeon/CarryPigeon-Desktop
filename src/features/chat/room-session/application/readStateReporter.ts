/**
 * @fileoverview 读状态上报辅助（节流 + 单调时间）。
 * @description chat/room-session｜application：读状态推进与上报辅助。
 */

import type { ChatReadStateReporterPort } from "@/features/chat/application/ports/runtimePorts";
import { shouldAdvanceReadMarker } from "@/features/chat/domain/utils/readMarker";
import { createLogger } from "@/shared/utils/logger";
import type { SessionReadStateApiPort, SessionScopePort } from "./ports";

const logger = createLogger("roomSessionReadStateReporter");

export type ReadStateReporterDeps = {
  api: SessionReadStateApiPort;
  scope: SessionScopePort;
  lastReadTimeMsByChannel: Record<string, number>;
  lastReadMidByChannel: Record<string, string>;
  lastReadReportAtMsByChannel: Record<string, number>;
};

export type ReadStateReporter = ChatReadStateReporterPort;

export function createReadStateReporter(deps: ReadStateReporterDeps): ReadStateReporter {
  function advanceLocalReadTime(cid: string, nowMs: number): number {
    const channelId = String(cid).trim();
    if (!channelId) return nowMs;
    const now = Number.isFinite(nowMs) ? Math.trunc(nowMs) : Date.now();
    const prevReadTime = Number(deps.lastReadTimeMsByChannel[channelId] ?? 0);
    const nextReadTime = Math.max(now, prevReadTime + 1);
    deps.lastReadTimeMsByChannel[channelId] = nextReadTime;
    return nextReadTime;
  }

  function syncLocalReadMarker(cid: string, lastMid: string, lastReadTimeMs: number): void {
    const channelId = String(cid).trim();
    const mid = String(lastMid).trim();
    if (!channelId || !mid) return;
    const nextReadTime = Math.trunc(Number(lastReadTimeMs) || 0);
    const prevReadTime = Number(deps.lastReadTimeMsByChannel[channelId] ?? 0);
    const prevReadMid = String(deps.lastReadMidByChannel[channelId] ?? "");
    if (!shouldAdvanceReadMarker(prevReadTime, prevReadMid, nextReadTime, mid)) return;
    deps.lastReadTimeMsByChannel[channelId] = nextReadTime;
    deps.lastReadMidByChannel[channelId] = mid;
  }

  function canReportNow(cid: string, nowMs: number, minIntervalMs: number = 1500): boolean {
    const channelId = String(cid).trim();
    if (!channelId) return false;
    const now = Number.isFinite(nowMs) ? Math.trunc(nowMs) : Date.now();
    const lastReportAt = Number(deps.lastReadReportAtMsByChannel[channelId] ?? 0);
    return now - lastReportAt > Math.max(0, Math.trunc(minIntervalMs));
  }

  async function reportIfAllowed(
    cid: string,
    lastMid: string,
    lastReadTimeMs: number,
    nowMs: number,
    minIntervalMs: number = 1500,
  ): Promise<boolean> {
    const channelId = String(cid).trim();
    const mid = String(lastMid).trim();
    if (!channelId || !mid) return false;
    syncLocalReadMarker(channelId, mid, lastReadTimeMs);
    const now = Number.isFinite(nowMs) ? Math.trunc(nowMs) : Date.now();
    if (!canReportNow(channelId, now, minIntervalMs)) return false;

    const [socket, token] = await deps.scope.getSocketAndValidToken();
    if (!socket || !token) return false;
    const requestSocket = socket;
    const requestScopeVersion = deps.scope.getActiveScopeVersion();

    const req = { lastReadMessageId: mid, lastReadTime: Math.trunc(Number(lastReadTimeMs) || 0) };
    try {
      await deps.api.updateReadState(socket, token, channelId, req);
      if (deps.scope.getActiveServerSocket() !== requestSocket) return false;
      if (deps.scope.getActiveScopeVersion() !== requestScopeVersion) return false;
      syncLocalReadMarker(channelId, mid, req.lastReadTime);
      deps.lastReadReportAtMsByChannel[channelId] = now;
      return true;
    } catch (error) {
      logger.warn("Action: chat_read_state_report_failed", { channelId, error: String(error) });
      return false;
    }
  }

  return { advanceLocalReadTime, canReportNow, reportIfAllowed };
}
