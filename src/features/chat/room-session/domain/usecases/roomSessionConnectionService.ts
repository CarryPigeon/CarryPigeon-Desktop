/**
 * @fileoverview room-session 连接 application service。
 * @description
 * 统一封装 ensure-ready 过程中涉及的频道刷新、当前频道恢复、WS/polling 选择与 session hook 生命周期。
 *
 * 这是 room-session 最重的 application service，
 * 因为它承担的是“会话进入可运行状态”的完整编排责任。
 */

import type { ChatEventsConnectOptions } from "@/features/chat/domain/ports/chatEventsPort";
import type { ChatEventEnvelope } from "@/features/chat/domain/types/chatEventModels";
import type { PollingFallbackController } from "../services/pollingFallback";
import type { ChatSessionWsManager } from "../services/wsManager";

type LoggerLike = {
  info(message: string, payload?: Record<string, unknown>): void;
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
  wsManager: ChatSessionWsManager;
  polling: PollingFallbackController | null;
  stopPolling: () => void;
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
  private readonly reconnectScheduledByScope = new Set<string>();
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
      const shouldDisableWs = origin.startsWith("https://") && tlsPolicy !== "strict";

      if (shouldDisableWs) {
        if (isStale()) return;
        this.deps.wsManager.close();
        if (this.deps.polling && this.deps.polling.isRunningFor(key)) return;
        this.deps.stopPolling();
        this.deps.logger.info("Action: chat_ws_disabled_polling_fallback_started", { socket: key, tlsPolicy, origin });
        this.deps.polling?.start(key);
        return;
      }

      if (isStale()) return;
      this.deps.stopPolling();

      const options: ChatEventsConnectOptions = {
        wsUrlOverride: this.deps.getWsUrlOverride(key),
        onResumeFailed: (reason) => {
          this.deps.onResumeFailed(key, reason);
        },
        onAuthError: () => {
          this.scheduleReconnect(requestScopeKey);
        },
      };
      this.deps.wsManager.ensureConnected(key, token, this.deps.onWsEvent, options);
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
   * 在 authError 等需要延迟重连的场景下安排一次异步重入。
   */
  private scheduleReconnect(scopeKey: string): void {
    if (this.reconnectScheduledByScope.has(scopeKey)) return;
    this.reconnectScheduledByScope.add(scopeKey);
    window.setTimeout(() => {
      this.reconnectScheduledByScope.delete(scopeKey);
      void this.ensureChatReady();
    }, 0);
  }
}
