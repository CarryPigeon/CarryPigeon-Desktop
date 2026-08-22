/**
 * @fileoverview 偏好感知补拉调度器。
 * @description chat/room-session｜application：对“通知级别非 all”的频道做低频 HTTP 补拉。
 *
 * 背景：
 * - 服务端 realtime 侧会按通知偏好过滤 `message.created` 等事件（见
 *   RealtimeNotificationPreferenceFilter），被设为 mentions_only/muted 的频道
 *   无法依赖 WS 推送保持时间线与未读实时；
 * - 在服务端语义修正前，客户端对该类频道自行低频补拉兜底，
 *   频道级 mention.created 快路径由事件路由器单独处理。
 *
 * 设计目标：
 * - 与 PollingFallbackController 同构的启停语义，便于组合层统一编排；
 * - 单轮内顺序补拉并做 in-flight 去重，避免请求堆积；
 * - 绑定启动时的 socket/scope，切服后自动失效。
 */

export type PreferenceCatchUpSchedulerDeps = {
  /**
   * 补拉轮询间隔（毫秒）。
   */
  intervalMs: number;
  /**
   * 获取当前激活的 server socket（trim 后）。
   */
  getActiveServerSocket: () => string;
  /**
   * 获取当前 scope 版本号。
   */
  getActiveScopeVersion: () => number;
  /**
   * 列出生效通知级别非 all 的频道 id。
   */
  listNonAllChannels: () => string[];
  /**
   * 拉取并合并某频道的最新一页消息（含未读投影重算）。
   */
  refreshChannelLatestPage: (cid: string) => Promise<void>;
};

/**
 * 偏好感知补拉调度器控制器。
 */
export type PreferenceCatchUpScheduler = {
  /**
   * 当前是否正在为指定 socket key 运行。
   */
  isRunningFor(socketKey: string): boolean;
  /**
   * 启动调度（若已为同一 key 运行则无操作；不同 key 则先停止再启动）。
   */
  start(socketKey: string): void;
  /**
   * 停止调度（幂等）。
   */
  stop(): void;
};

/**
 * 创建偏好感知补拉调度器。
 *
 * @param deps - 依赖注入。
 * @returns 调度器控制器。
 */
export function createPreferenceCatchUpScheduler(
  deps: PreferenceCatchUpSchedulerDeps,
): PreferenceCatchUpScheduler {
  let timer: ReturnType<typeof setInterval> | null = null;
  let runningKey = "";
  let runningScopeVersion = -1;
  let roundInFlight = false;

  /**
   * 停止当前调度（幂等）。
   *
   * @returns 无返回值。
   */
  function stop(): void {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
    runningKey = "";
    runningScopeVersion = -1;
    roundInFlight = false;
  }

  /**
   * 执行一轮补拉：对每个非 all 频道顺序刷新最新页。
   *
   * @returns 无返回值。
   */
  async function runRound(key: string, scopeVersion: number): Promise<void> {
    const isStale = (): boolean =>
      deps.getActiveServerSocket() !== key || deps.getActiveScopeVersion() !== scopeVersion;
    const channelIds = deps.listNonAllChannels();
    for (const cid of channelIds) {
      if (isStale()) return;
      try {
        await deps.refreshChannelLatestPage(cid);
      } catch {
        // 单个频道失败不影响其余频道；下一轮继续尝试。
      }
    }
  }

  /**
   * 启动调度。
   *
   * @param socketKey - 服务端 socket key。
   * @returns 无返回值。
   */
  function start(socketKey: string): void {
    const key = String(socketKey ?? "").trim();
    if (!key) return;
    if (isRunningFor(key)) return;
    stop();

    runningKey = key;
    runningScopeVersion = deps.getActiveScopeVersion();
    timer = setInterval(() => {
      if (roundInFlight) return;
      const isStale =
        deps.getActiveServerSocket() !== runningKey ||
        deps.getActiveScopeVersion() !== runningScopeVersion;
      if (isStale) return;
      roundInFlight = true;
      void runRound(runningKey, runningScopeVersion).finally(() => {
        roundInFlight = false;
      });
    }, Math.max(0, Math.trunc(Number(deps.intervalMs ?? 0))));
  }

  /**
   * 判断是否正在为指定 socket key 运行。
   *
   * @param socketKey - 服务端 socket key。
   * @returns 正在运行且 key 匹配时为 true。
   */
  function isRunningFor(socketKey: string): boolean {
    const key = String(socketKey ?? "").trim();
    return Boolean(timer) && Boolean(key) && runningKey === key;
  }

  return { isRunningFor, start, stop };
}
