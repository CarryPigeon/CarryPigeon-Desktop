/**
 * @fileoverview WS 不可用时的 HTTP polling 降级控制器。
 * @description chat｜展示层状态（store）：liveChatPollingFallback。
 *
 * 背景：
 * - WebView 的 WebSocket 在非 strict TLS 策略下通常无法绕过证书校验；
 * - 为了保证基础可用性，需要在 WS 不可用时自动降级为“HTTP 定时补拉”。
 *
 * 设计目标：
 * - 把定时器状态与 in-flight 管理收敛为一个小模块，避免散落在 store 里；
 * - 支持按 socket key 切换：切换 server 时旧 polling 必须停止。
 *
 * 约定：
 * - 注释中文；日志英文（由调用方的 logger 输出）。
 */

export type LiveChatPollingFallbackDeps = {
  /**
   * polling 间隔（毫秒）。
   */
  intervalMs: number;
  /**
   * 获取当前激活的 server socket（trim 后）。
   */
  getActiveServerSocket: () => string;
  /**
   * 获取当前频道 id（trim 后）。
   */
  getCurrentChannelId: () => string;
  /**
   * 刷新频道列表与未读计数。
   */
  refreshChannels: () => Promise<void>;
  /**
   * 刷新某频道的最新页消息（用于恢复上下文）。
   */
  refreshChannelLatestPage: (cid: string) => Promise<void>;
};

/**
 * WS 降级为 HTTP polling 时的控制器接口。
 */
export type LiveChatPollingFallbackController = {
  /**
   * 当前是否正在为指定 socket key 运行 polling。
   */
  isRunningFor(socketKey: string): boolean;
  /**
   * 启动 polling（若已为同一 key 运行则无操作；若为不同 key 运行则先停止再启动）。
   */
  start(socketKey: string): void;
  /**
   * 停止 polling（幂等）。
   */
  stop(): void;
};

/**
 * 创建 polling 降级控制器。
 *
 * @param deps - 依赖注入。
 * @returns controller。
 */
export function createLiveChatPollingFallback(deps: LiveChatPollingFallbackDeps): LiveChatPollingFallbackController {
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let pollKey: string = "";
  let pollInFlight: boolean = false;

  /**
   * 停止当前 polling（幂等）。
   *
   * @returns void。
   */
  function stop(): void {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
    pollKey = "";
    pollInFlight = false;
  }

  /**
   * 判断是否正在为指定 socket key 运行 polling。
   *
   * @param socketKey - 服务端 socket key。
   * @returns 当正在运行且 key 匹配时返回 true。
   */
  function isRunningFor(socketKey: string): boolean {
    const key = String(socketKey ?? "").trim();
    return Boolean(pollTimer) && Boolean(key) && pollKey === key;
  }

  /**
   * 启动 polling。
   *
   * 说明：
   * - 若当前已为同一 key 运行，则无操作；
   * - 若为不同 key 运行，则先停止旧 polling 再启动新 polling。
   *
   * @param socketKey - 服务端 socket key。
   * @returns void。
   */
  function start(socketKey: string): void {
    const key = String(socketKey ?? "").trim();
    if (!key) return;
    if (isRunningFor(key)) return;
    stop();

    pollKey = key;
    pollTimer = setInterval(() => {
      if (pollInFlight) return;
      pollInFlight = true;
      void (async () => {
        try {
          if (deps.getActiveServerSocket() !== key) return;
          await deps.refreshChannels();
          const cid = deps.getCurrentChannelId();
          if (cid) await deps.refreshChannelLatestPage(cid);
        } finally {
          pollInFlight = false;
        }
      })();
    }, Math.max(0, Math.trunc(Number(deps.intervalMs ?? 0))));
  }

  return { isRunningFor, start, stop };
}
