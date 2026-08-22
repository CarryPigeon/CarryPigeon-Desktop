/**
 * @fileoverview room-session 连接 application service。
 * @description
 * 统一封装 ensure-ready 过程中涉及的频道刷新、当前频道恢复、WS/polling 选择与 session hook 生命周期。
 *
 * 这是 room-session 最重的 application service，
 * 因为它承担的是“会话进入可运行状态”的完整编排责任。
 */

import type { ChatEventsConnectOptions } from "@/features/chat/domain/types/chatEventModels";
import type { ChatEventEnvelope } from "@/features/chat/domain/types/chatEventModels";
import type { PollingFallbackController } from "../services/pollingFallback";
import type { PreferenceCatchUpScheduler } from "../services/preferenceCatchUpScheduler";
import type { ChatSessionWsManager } from "../services/wsManager";

type LoggerLike = {
  info(message: string, payload?: Record<string, unknown>): void;
  warn(message: string, payload?: Record<string, unknown>): void;
};

type SessionListenerStopper = (() => void) | null;
type AutoRefreshStopper = (() => void) | null;

/**
 * `RoomSessionConnectionApplicationService` 的依赖集合。
 *
 * 这类依赖明显分成三组：
 * - scope / auth：当前 socket、token、scopeVersion
 * - session 初始化：目录刷新、当前频道恢复、成员侧栏刷新
 * - connection 策略：WS、polling、auto-refresh、reauth、resume.failed
 */
export type RoomSessionConnectionApplicationServiceDeps = {
  logger: LoggerLike;
  getSocketAndValidToken: () => Promise<[string, string]>;
  getActiveServerSocket: () => string;
  getActiveScopeVersion: () => number;
  refreshChannels: () => Promise<void>;
  loadChannelMessages: (cid: string) => Promise<void>;
  refreshMembersRail: (cid: string) => Promise<void>;
  getCurrentChannelId: () => string;
  setCurrentChannelIdIfEmpty: () => void;
  getTlsPolicyForSocket: (socketKey: string) => string;
  toHttpOrigin: (socketKey: string) => string;
  getWsUrlOverride: (socketKey: string) => string | undefined;
  /**
   * 查询某 server 是否在 `/api/server` 中声明提供 realtime（WS）能力。
   *
   * 当返回 `false` 时（典型场景：服务端 `realtime.enabled=false`，`ws_url` 为空，
   * `capabilities.event_resume` 为 `false`），客户端将直接启用 long-polling，
   * 不再尝试连接 `ws://<http-port>/api/ws`（HTTP 端口不开 WS，握手必然失败）。
   */
  isRealtimeAvailable: (socketKey: string) => boolean;
  wsManager: ChatSessionWsManager;
  polling: PollingFallbackController | null;
  stopPolling: () => void;
  /**
   * 偏好感知补拉调度器（可空）。
   *
   * 背景：服务端 realtime 会按通知偏好过滤 mentions_only/muted 频道的
   * `message.created` 事件，该类频道无法依赖 WS 推送保持实时，
   * 由客户端低频补拉兜底；会话就绪后启动，切服/销毁由外层停止。
   */
  preferenceCatchUp: PreferenceCatchUpScheduler | null;
  startAutoRefresh: (socketKey: string) => { stop: () => void };
  onAuthSessionChanged: (socketKey: string, listener: (session: { accessToken?: string } | null) => void) => () => void;
  onWsEvent: (evt: ChatEventEnvelope) => void;
  onResumeFailed: (socketKey: string, reason: string) => void;
};

/**
 * room-session 子域中负责“连接就绪与连接生命周期”的 application service。
 */
export class RoomSessionConnectionApplicationService {
  private readonly inFlightByScope = new Map<string, Promise<void>>();
  /**
   * 已进入“WS 降级 → HTTP polling”状态的 socket 集合。
   *
   * 由 WS 客户端的 onConnectionLost / onConnectionRestored 回调驱动，
   * 用于保证降级只启动一次、恢复只停止一次。
   */
  private readonly degradedSockets = new Set<string>();
  /**
   * 每个 socket 上一次“用新 token 重建连接”所使用的 token。
   *
   * 用于在 auth 错误风暴中避免拿同一个失效 token 反复重建。
   */
  private readonly lastRecoveryTokenBySocket = new Map<string, string>();
  private sessionHooksSocket = "";
  private stopAutoRefresh: AutoRefreshStopper = null;
  private stopSessionListener: SessionListenerStopper = null;

  constructor(private readonly deps: RoomSessionConnectionApplicationServiceDeps) {}

  /**
   * 释放当前 socket 绑定的 auto-refresh 与 auth-session 监听器。
   *
   * 注意：
   * - 这里只处理 hook；
   * - WS 关闭和 polling 停止仍由外层 runtime 协调。
   */
  teardownSessionHooks(): void {
    this.stopAutoRefresh?.();
    this.stopSessionListener?.();
    this.stopAutoRefresh = null;
    this.stopSessionListener = null;
    this.sessionHooksSocket = "";
    // 作用域钩子已释放：降级与重建尝试的记录一并清理，
    // 避免切服后旧 socket 的降级态影响新作用域。
    this.degradedSockets.clear();
    this.lastRecoveryTokenBySocket.clear();
  }

  /**
   * 确保当前 chat 会话进入“可运行”状态。
   *
   * 主要步骤：
   * 1. 获取有效 socket/token 并固定请求 scope
   * 2. 刷新频道目录
   * 3. 恢复当前频道并加载时间线
   * 4. 根据 TLS 策略决定 WS 还是 polling
   * 5. 建立 reconnect / reauth / resume.failed 的后续处理
   *
   * 幂等性：
   * - 同一 scopeKey 上并发调用会复用 in-flight Promise
   * - scope 切换后旧请求结果会被静默丢弃
   */
  async ensureChatReady(): Promise<void> {
    const requestScopeVersion = this.deps.getActiveScopeVersion();
    const [socket, token] = await this.deps.getSocketAndValidToken();
    if (!socket || !token) return;
    const requestSocket = socket;
    const requestScopeKey = `${requestSocket}::${requestScopeVersion}`;
    const isStale = (): boolean =>
      this.deps.getActiveServerSocket() !== requestSocket || this.deps.getActiveScopeVersion() !== requestScopeVersion;

    if (isStale()) return;
    const existing = this.inFlightByScope.get(requestScopeKey);
    if (existing) return existing;

    const task = (async () => {
      if (isStale()) return;
      this.ensureSessionHooks(requestSocket);
      // 会话就绪即启动偏好补拉：无论走 WS 还是 polling，
      // mentions_only/muted 频道都需要客户端自行补拉保持时间线与未读新鲜。
      this.deps.preferenceCatchUp?.start(requestSocket);

      await this.deps.refreshChannels();
      if (isStale()) return;

      this.deps.setCurrentChannelIdIfEmpty();
      const cid = this.deps.getCurrentChannelId();
      if (cid) {
        await this.deps.loadChannelMessages(cid);
        if (isStale()) return;
        void this.deps.refreshMembersRail(cid);
      }

      const key = requestSocket;
      const tlsPolicy = this.deps.getTlsPolicyForSocket(key);
      const origin = this.deps.toHttpOrigin(key);
      // WS 启用条件：
      // - 登录 origin 非 HTTPS-非-strict TLS（保持既有兼容回退逻辑）；
      // - 且服务端在 `/api/server` 声明了 realtime 能力（`ws_url` 非空或 `event_resume=true`）。
      // 任一不满足即禁用 WS 并改走 long-polling，避免
      // `ws://<http-port>/api/ws` 在 HTTP-only 服务端永远握手失败并陷入静默指数退避死循环。
      const tlsIncompatibleWs = origin.startsWith("https://") && tlsPolicy !== "strict";
      const realtimeUnavailable = !this.deps.isRealtimeAvailable(key);
      const shouldDisableWs = tlsIncompatibleWs || realtimeUnavailable;

      if (shouldDisableWs) {
        if (isStale()) return;
        this.deps.wsManager.close();
        if (this.deps.polling && this.deps.polling.isRunningFor(key)) return;
        this.deps.stopPolling();
        this.deps.logger.info("Action: chat_ws_disabled_polling_fallback_started", { socket: key, tlsPolicy, origin, realtimeUnavailable });
        this.deps.polling?.start(key);
        return;
      }

      if (isStale()) return;

      const options = this.buildConnectOptions(key);
      const { reused } = this.deps.wsManager.ensureConnected(key, token, this.deps.onWsEvent, options);
      if (!reused) {
        // 新建连接视为一次恢复尝试：乐观停止降级轮询；
        // 若随后认证仍失败，onConnectionLost 会重新降级，不会出现永久静默。
        this.markFreshConnectionCreated(key);
      }
    })().finally(() => {
      this.inFlightByScope.delete(requestScopeKey);
    });

    this.inFlightByScope.set(requestScopeKey, task);
    return task;
  }

  /**
   * 确保“当前 socket 的一套 session hooks”只安装一次。
   */
  private ensureSessionHooks(socket: string): void {
    if (this.sessionHooksSocket === socket && this.stopAutoRefresh && this.stopSessionListener) return;
    if (this.sessionHooksSocket && this.sessionHooksSocket !== socket) {
      this.stopAutoRefresh?.();
      this.stopAutoRefresh = null;
      this.stopSessionListener?.();
      this.stopSessionListener = null;
    }
    this.sessionHooksSocket = socket;
    if (!this.stopAutoRefresh) this.stopAutoRefresh = this.deps.startAutoRefresh(socket).stop;
    if (!this.stopSessionListener) {
      this.stopSessionListener = this.deps.onAuthSessionChanged(socket, (session) => {
        const next = session?.accessToken ?? "";
        this.deps.wsManager.reauthIfConnectedFor(socket, next);
      });
    }
  }

  /**
   * 构建某个 socket 的 WS 连接选项（含降级/恢复/认证错误回调）。
   */
  private buildConnectOptions(socketKey: string): ChatEventsConnectOptions {
    return {
      wsUrlOverride: this.deps.getWsUrlOverride(socketKey),
      onResumeFailed: (reason) => {
        this.deps.onResumeFailed(socketKey, reason);
      },
      onAuthError: (reason) => {
        this.handleAuthError(socketKey, reason);
      },
      onConnectionLost: () => {
        this.degradeToPolling(socketKey);
      },
      onConnectionRestored: () => {
        this.recoverFromPolling(socketKey);
      },
    };
  }

  /**
   * 新建 WS 连接后的统一处理：清除降级标记并乐观停止 polling。
   *
   * 若新连接随后认证失败，onConnectionLost 会重新进入降级态。
   */
  private markFreshConnectionCreated(socketKey: string): void {
    const key = String(socketKey ?? "").trim();
    if (!key) return;
    this.degradedSockets.delete(key);
    if (!this.deps.polling?.isRunningFor(key)) return;
    this.deps.stopPolling();
  }

  /**
   * 连接持续失败：降级为 HTTP polling（幂等）。
   */
  private degradeToPolling(socketKey: string): void {
    const key = String(socketKey ?? "").trim();
    if (!key) return;
    this.degradedSockets.add(key);
    if (this.deps.polling?.isRunningFor(key)) return;
    this.deps.stopPolling();
    this.deps.logger.info("Action: chat_ws_degraded_to_polling", { socket: key });
    this.deps.polling?.start(key);
  }

  /**
   * 连接恢复：退出降级态并停止 polling。
   */
  private recoverFromPolling(socketKey: string): void {
    const key = String(socketKey ?? "").trim();
    if (!key) return;
    if (!this.degradedSockets.delete(key)) return;
    this.deps.logger.info("Action: chat_ws_recovered_from_polling", { socket: key });
    this.deps.stopPolling();
  }

  /**
   * 处理 auth/reauth 错误：尝试用最新 token 强制重建连接；
   * 拿不到“不同的有效 token”时降级为 polling 兜底。
   */
  private handleAuthError(socketKey: string, reason: string): void {
    const key = String(socketKey ?? "").trim();
    if (!key) return;
    void (async () => {
      try {
        const [socket, rawToken] = await this.deps.getSocketAndValidToken();
        const freshToken = String(rawToken ?? "").trim();
        const lastAttempted = this.lastRecoveryTokenBySocket.get(key) ?? "";
        if (socket !== key || !freshToken || freshToken === lastAttempted) {
          // 拿不到新 token，或与上次重建尝试相同：先降级轮询，
          // 等 token 真正轮换后再由下一次 auth 错误触发重建。
          this.degradeToPolling(key);
          return;
        }
        this.lastRecoveryTokenBySocket.set(key, freshToken);
        this.deps.logger.warn("Action: chat_ws_reconnect_with_fresh_token", {
          socket: key,
          reason,
        });
        this.deps.wsManager.forceReconnect(key, freshToken, this.deps.onWsEvent, this.buildConnectOptions(key));
        this.markFreshConnectionCreated(key);
      } catch (error) {
        this.deps.logger.warn("Action: chat_ws_auth_error_recovery_failed", {
          socket: key,
          error: String(error),
        });
        this.degradeToPolling(key);
      }
    })();
  }
}
