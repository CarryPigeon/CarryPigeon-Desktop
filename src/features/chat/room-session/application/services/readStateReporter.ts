/**
 * @fileoverview 读状态上报辅助（节流 + 单调时间）。
 * @description chat/room-session｜application：读状态推进与上报辅助。
 */

import type { ChatReadStateReporterPort } from "@/features/chat/application/ports/runtimePorts";
import { shouldAdvanceReadMarker } from "@/features/chat/domain/utils/readMarker";
import { createLogger } from "@/shared/utils/logger";
import type {
  SessionReadMarkerStatePort,
  SessionReadStateApiPort,
  SessionScopePort,
} from "../ports/sessionPorts";

const logger = createLogger("roomSessionReadStateReporter");

export type ReadStateReporterDeps = {
  /**
   * 读状态上报器同时维护三份本地数据：
   * - lastReadTime
   * - lastReadMid
   * - 上一次真正发出请求的时间
   */
  api: SessionReadStateApiPort;
  scope: SessionScopePort;
  state: SessionReadMarkerStatePort;
};

export type ReadStateReporter = ChatReadStateReporterPort;

export function createReadStateReporter(deps: ReadStateReporterDeps): ReadStateReporter {
  /**
   * 推进本地读时间。
   *
   * 约束：
   * - 必须单调递增；
   * - 即便同一毫秒内多次推进，也会强制 +1，避免被服务端视为旧值。
   */
  function advanceLocalReadTime(cid: string, nowMs: number): number {
    const channelId = String(cid).trim();
    if (!channelId) return nowMs;
    const now = Number.isFinite(nowMs) ? Math.trunc(nowMs) : Date.now();
    const prevReadTime = deps.state.readLastReadTimeMs(channelId);
    const nextReadTime = Math.max(now, prevReadTime + 1);
    deps.state.writeLastReadTimeMs(channelId, nextReadTime);
    return nextReadTime;
  }

  function syncLocalReadMarker(cid: string, lastMid: string, lastReadTimeMs: number): void {
    const channelId = String(cid).trim();
    const mid = String(lastMid).trim();
    if (!channelId || !mid) return;
    const nextReadTime = Math.trunc(Number(lastReadTimeMs) || 0);
    const prevReadTime = deps.state.readLastReadTimeMs(channelId);
    const prevReadMid = deps.state.readLastReadMessageId(channelId);
    if (!shouldAdvanceReadMarker(prevReadTime, prevReadMid, nextReadTime, mid)) return;
    deps.state.writeLastReadTimeMs(channelId, nextReadTime);
    deps.state.writeLastReadMessageId(channelId, mid);
  }

  function canReportNow(cid: string, nowMs: number, minIntervalMs: number = 1500): boolean {
    const channelId = String(cid).trim();
    if (!channelId) return false;
    const now = Number.isFinite(nowMs) ? Math.trunc(nowMs) : Date.now();
    const lastReportAt = deps.state.readLastReportAtMs(channelId);
    return now - lastReportAt > Math.max(0, Math.trunc(minIntervalMs));
  }

  async function reportIfAllowed(
    cid: string,
    lastMid: string,
    lastReadTimeMs: number,
    nowMs: number,
    minIntervalMs: number = 1500,
  ): Promise<boolean> {
    /**
     * 真正的上报入口。
     *
     * 顺序：
     * 1. 先同步本地 marker
     * 2. 再判断限流
     * 3. 发起远端请求
     * 4. 返回后再次做 stale-scope 检查
     */
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
      deps.state.writeLastReportAtMs(channelId, now);
      return true;
    } catch (error) {
      logger.warn("Action: chat_read_state_report_failed", { channelId, error: String(error) });
      return false;
    }
  }

  return { advanceLocalReadTime, canReportNow, reportIfAllowed };
}
