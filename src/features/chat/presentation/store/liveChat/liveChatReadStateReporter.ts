/**
 * @fileoverview liveChat 读状态上报辅助（节流 + 单调时间）。
 * @description chat｜展示层状态（store）：liveChatReadStateReporter。
 *
 * 背景：
 * - 服务端通过 `last_read_mid` + `last_read_time` 记录用户读进度；
 * - 客户端需要保证 `last_read_time` 单调递增，并对上报做节流，避免频繁请求。
 *
 * 约定：
 * - 注释中文；日志英文（本模块不输出日志）。
 */

import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { ReadStateRequestDto } from "@/features/chat/domain/types/chatWireDtos";

/**
 * 创建读状态上报辅助实例的依赖集合。
 */
export type LiveChatReadStateReporterDeps = {
  /**
   * chat HTTP API 端口。
   */
  api: ChatApiPort;
  /**
   * 获取当前 server socket 与可用 access token（均为 trim 后）。
   */
  getSocketAndValidToken: () => Promise<[string, string]>;
  /**
   * 每个频道的最新读时间（ms）。
   */
  lastReadTimeMsByChannel: Record<string, number>;
  /**
   * 每个频道上一次上报读状态的时间（ms，用于节流）。
   */
  lastReadReportAtMsByChannel: Record<string, number>;
};

/**
 * 读状态上报辅助能力集合（节流 + 单调时间）。
 */
export type LiveChatReadStateReporter = {
  /**
   * 推进本地读时间，并保证单调递增。
   *
   * @param cid - 频道 id。
   * @param nowMs - 当前时间（ms）。
   * @returns 推进后的 `last_read_time`（ms）。
   */
  advanceLocalReadTime(cid: string, nowMs: number): number;
  /**
   * 判断当前是否满足上报节流窗口。
   *
   * @param cid - 频道 id。
   * @param nowMs - 当前时间（ms）。
   * @param minIntervalMs - 最小间隔（默认 1500ms）。
   * @returns 允许上报返回 true。
   */
  canReportNow(cid: string, nowMs: number, minIntervalMs?: number): boolean;
  /**
   * 尝试上报读状态（内部包含节流判断；成功触发时会更新 `lastReadReportAtMsByChannel`）。
   *
   * @param cid - 频道 id。
   * @param lastMid - 最新已读消息 id。
   * @param lastReadTimeMs - 最新已读时间（ms）。
   * @param nowMs - 当前时间（ms，用于节流）。
   * @param minIntervalMs - 最小间隔（默认 1500ms）。
   * @returns 若触发上报返回 true；否则返回 false。
   */
  reportIfAllowed(
    cid: string,
    lastMid: string,
    lastReadTimeMs: number,
    nowMs: number,
    minIntervalMs?: number,
  ): Promise<boolean>;
};

/**
 * 创建读状态上报辅助实例。
 *
 * @param deps - 依赖注入。
 * @returns LiveChatReadStateReporter。
 */
export function createLiveChatReadStateReporter(deps: LiveChatReadStateReporterDeps): LiveChatReadStateReporter {
  /**
   * 推进本地读时间，并保证单调递增。
   *
   * @param cid - 频道 id。
   * @param nowMs - 当前时间（ms）。
   * @returns 推进后的 `last_read_time`（ms）。
   */
  function advanceLocalReadTime(cid: string, nowMs: number): number {
    const channelId = String(cid).trim();
    if (!channelId) return nowMs;
    const now = Number.isFinite(nowMs) ? Math.trunc(nowMs) : Date.now();
    const prevReadTime = Number(deps.lastReadTimeMsByChannel[channelId] ?? 0);
    const nextReadTime = Math.max(now, prevReadTime + 1);
    deps.lastReadTimeMsByChannel[channelId] = nextReadTime;
    return nextReadTime;
  }

  /**
   * 判断当前是否满足上报节流窗口。
   *
   * @param cid - 频道 id。
   * @param nowMs - 当前时间（ms）。
   * @param minIntervalMs - 最小间隔（默认 1500ms）。
   * @returns 允许上报返回 true。
   */
  function canReportNow(cid: string, nowMs: number, minIntervalMs: number = 1500): boolean {
    const channelId = String(cid).trim();
    if (!channelId) return false;
    const now = Number.isFinite(nowMs) ? Math.trunc(nowMs) : Date.now();
    const lastReportAt = Number(deps.lastReadReportAtMsByChannel[channelId] ?? 0);
    return now - lastReportAt > Math.max(0, Math.trunc(minIntervalMs));
  }

  /**
   * 尝试上报读状态（内部包含节流判断；成功触发时会更新 `lastReadReportAtMsByChannel`）。
   *
   * @param cid - 频道 id。
   * @param lastMid - 最新已读消息 id。
   * @param lastReadTimeMs - 最新已读时间（ms）。
   * @param nowMs - 当前时间（ms，用于节流）。
   * @param minIntervalMs - 最小间隔（默认 1500ms）。
   * @returns 若触发上报返回 true；否则返回 false。
   */
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
    const now = Number.isFinite(nowMs) ? Math.trunc(nowMs) : Date.now();
    if (!canReportNow(channelId, now, minIntervalMs)) return false;

    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) return false;

    deps.lastReadReportAtMsByChannel[channelId] = now;
    const req: ReadStateRequestDto = { last_read_mid: mid, last_read_time: Math.trunc(Number(lastReadTimeMs) || 0) };
    void deps.api.updateReadState(socket, token, channelId, req);
    return true;
  }

  return { advanceLocalReadTime, canReportNow, reportIfAllowed };
}
