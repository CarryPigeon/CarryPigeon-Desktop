/**
 * @fileoverview 会话就绪编排（频道数据 + WS/轮询链路）。
 * @description chat/room-session｜application：当前 server scope 的会话就绪编排。
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

export type EnsureReadyDeps = {
  /**
   * `ensureReady()` 需要把多个 room-session 子模块串起来：
   * - 频道目录刷新
   * - 当前频道消息加载
   * - members rail 刷新
   * - WS / polling 选择
   * - auth-session 监听与 reauth
   */
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
  getStopAutoRefresh: () => AutoRefreshStopper;
  setStopAutoRefresh: (stopper: AutoRefreshStopper) => void;
  getStopSessionListener: () => SessionListenerStopper;
  setStopSessionListener: (stopper: SessionListenerStopper) => void;
  onWsEvent: (evt: ChatEventEnvelope) => void;
  onResumeFailed: (socketKey: string, reason: string) => void;
};

export function createEnsureReady(deps: EnsureReadyDeps) {
  const inFlightByScope = new Map<string, Promise<void>>();
  const reconnectScheduledByScope = new Set<string>();
  let sessionHooksSocket = "";

  function ensureSessionHooks(socket: string): void {
    /**
     * 保证“当前 socket 对应的一套 session hook”只被装一次。
     *
     * hook 包括：
     * - auto refresh
     * - auth session changed -> ws reauth
     */
    if (sessionHooksSocket === socket && deps.getStopAutoRefresh() && deps.getStopSessionListener()) return;
    if (sessionHooksSocket && sessionHooksSocket !== socket) {
      deps.getStopAutoRefresh()?.();
      deps.setStopAutoRefresh(null);
      deps.getStopSessionListener()?.();
      deps.setStopSessionListener(null);
    }
    sessionHooksSocket = socket;
    if (!deps.getStopAutoRefresh()) deps.setStopAutoRefresh(deps.startAutoRefresh(socket).stop);
    if (!deps.getStopSessionListener()) {
      deps.setStopSessionListener(
        deps.onAuthSessionChanged(socket, (s) => {
          const next = s?.accessToken ?? "";
          deps.wsManager.reauthIfConnectedFor(socket, next);
        }),
      );
    }
  }

  function scheduleReconnect(scopeKey: string): void {
    if (reconnectScheduledByScope.has(scopeKey)) return;
    reconnectScheduledByScope.add(scopeKey);
    window.setTimeout(() => {
      reconnectScheduledByScope.delete(scopeKey);
      void ensureChatReady();
    }, 0);
  }

  async function ensureChatReady(): Promise<void> {
    /**
     * 这是 room-session 最核心的启动入口。
     *
     * 顺序：
     * 1. 校验当前 scope 与鉴权
     * 2. 刷新频道目录
     * 3. 保证当前频道存在，并加载其消息
     * 4. 根据 TLS 策略选择 WS 或 polling
     * 5. 安装 reconnect / resume.failed / authError 的后续处理
     */
    const requestScopeVersion = deps.getActiveScopeVersion();
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) return;
    const requestSocket = socket;
    const requestScopeKey = `${requestSocket}::${requestScopeVersion}`;
    const isStale = (): boolean =>
      deps.getActiveServerSocket() !== requestSocket || deps.getActiveScopeVersion() !== requestScopeVersion;

    if (isStale()) return;
    const existing = inFlightByScope.get(requestScopeKey);
    if (existing) return existing;

    const task = (async () => {
      if (isStale()) return;
      ensureSessionHooks(requestSocket);

      await deps.refreshChannels();
      if (isStale()) return;

      deps.setCurrentChannelIdIfEmpty();
      const cid = deps.getCurrentChannelId();
      if (cid) {
        await deps.loadChannelMessages(cid);
        if (isStale()) return;
        void deps.refreshMembersRail(cid);
      }

      const key = requestSocket;
      const tlsPolicy = deps.getTlsPolicyForSocket(key);
      const origin = deps.toHttpOrigin(key);
      const shouldDisableWs = origin.startsWith("https://") && tlsPolicy !== "strict";

      if (shouldDisableWs) {
        if (isStale()) return;
        deps.wsManager.close();
        if (deps.polling && deps.polling.isRunningFor(key)) return;
        deps.stopPolling();
        deps.logger.info("Action: chat_ws_disabled_polling_fallback_started", { socket: key, tlsPolicy, origin });
        deps.polling?.start(key);
        return;
      }

      if (isStale()) return;
      deps.stopPolling();

      const options: ChatEventsConnectOptions = {
        wsUrlOverride: deps.getWsUrlOverride(key),
        onResumeFailed: (reason) => {
          deps.onResumeFailed(key, reason);
        },
        onAuthError: () => {
          scheduleReconnect(requestScopeKey);
        },
      };
      deps.wsManager.ensureConnected(key, token, deps.onWsEvent, options);
    })().finally(() => {
      inFlightByScope.delete(requestScopeKey);
    });

    inFlightByScope.set(requestScopeKey, task);
    return task;
  }

  return ensureChatReady;
}
