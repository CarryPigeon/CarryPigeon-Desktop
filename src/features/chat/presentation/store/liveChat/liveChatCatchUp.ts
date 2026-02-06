/**
 * @fileoverview resume.failed 事件后的 HTTP 补拉策略（WS 降级恢复）。
 * @description chat｜展示层状态（store）：liveChatCatchUp。
 *
 * 背景：
 * - 在 WS resume 失败（例如断线重连失败、事件流错位等）后，服务端会发送 `resume.failed`；
 * - 客户端需要走 HTTP 补拉，尽力恢复频道列表/未读计数/当前上下文的消息页。
 *
 * 约束：
 * - 补拉应当“尽力而为”，避免 fan-out 过大导致请求风暴；
 * - 必须按“当前激活 server socket”做归因，切换 server 后应立即停止旧补拉。
 */

import type { ChatChannel } from "../chatStoreTypes";

type LoggerLike = {
  warn(message: string, payload?: Record<string, unknown>): void;
};

/**
 * `resume.failed` 补拉策略的依赖集合。
 */
export type ResumeFailedCatchUpDeps = {
  /**
   * 日志端口（日志内容要求英文）。
   */
  logger: LoggerLike;
  /**
   * 获取当前激活的 server socket（trim 后）。
   */
  getActiveServerSocket: () => string;
  /**
   * 获取当前选中的频道 id（trim 后）。
   */
  getCurrentChannelId: () => string;
  /**
   * 获取当前频道列表快照（用于推导未读频道）。
   */
  listChannels: () => ChatChannel[];
  /**
   * 刷新频道列表与未读计数。
   */
  refreshChannels: () => Promise<void>;
  /**
   * 刷新指定频道的最新页消息（不影响已加载的历史分页）。
   */
  refreshChannelLatestPage: (cid: string) => Promise<void>;
  /**
   * 刷新成员侧栏（尽力而为）。
   */
  refreshMembersRail: (cid: string) => Promise<void>;
  /**
   * 预取未读频道的上限（限制 fan-out，避免风暴）。
   */
  prefetchLimit: number;
};

/**
 * 创建 `resume.failed` 后的补拉处理函数。
 *
 * @param deps - 依赖注入（store 内部状态与 IO）。
 * @returns catchUpAfterResumeFailed 处理函数。
 */
export function createResumeFailedCatchUp(deps: ResumeFailedCatchUpDeps) {
  /**
   * 当 WS resume 失败后，执行一次“尽力而为”的 HTTP 补拉。
   *
   * 策略：
   * - `refreshChannels()`：刷新频道列表与未读计数；
   * - 当前频道：刷新最新页；
   * - 少量未读频道：刷新最新页（恢复上下文；限制上限避免风暴）。
   *
   * @param socketKey - resume 失败对应的 server socket key。
   * @param reason - 服务端返回的失败原因。
   * @returns Promise<void>。
   */
  return async function catchUpAfterResumeFailed(socketKey: string, reason: string): Promise<void> {
    const key = String(socketKey ?? "").trim();
    if (!key) return;
    if (deps.getActiveServerSocket() !== key) return;

    deps.logger.warn("Action: resume_failed_catch_up", { socket: key, reason });

    await deps.refreshChannels();
    if (deps.getActiveServerSocket() !== key) return;

    const ordered: string[] = [];
    const seen = new Set<string>();

    const current = deps.getCurrentChannelId();
    if (current) {
      ordered.push(current);
      seen.add(current);
    }

    // 尽力而为：预取少量未读频道，恢复上下文（限制 fan-out，避免风暴）。
    const limit = Math.max(0, Math.trunc(Number(deps.prefetchLimit ?? 0)));
    for (const c of deps.listChannels()) {
      if (ordered.length >= limit) break;
      const cid = String(c.id ?? "").trim();
      if (!cid || seen.has(cid)) continue;
      if ((c.unread ?? 0) <= 0) continue;
      ordered.push(cid);
      seen.add(cid);
    }

    for (const cid of ordered) {
      if (deps.getActiveServerSocket() !== key) return;
      try {
        await deps.refreshChannelLatestPage(cid);
      } catch (e) {
        deps.logger.warn("Action: catch_up_refresh_latest_failed", { cid, error: String(e) });
      }
    }

    if (current && deps.getActiveServerSocket() === key) void deps.refreshMembersRail(current);
  };
}
