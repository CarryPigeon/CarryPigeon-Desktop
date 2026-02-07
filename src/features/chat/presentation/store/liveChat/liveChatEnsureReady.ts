/**
 * @fileoverview liveChat 就绪编排（频道数据 + WS/轮询链路）。
 * @description chat｜展示层状态（store）：liveChatEnsureReady。
 *
 * 职责：
 * - 绑定“按 server socket”的会话钩子（自动刷新 + token 变更 → WS reauth）；
 * - 刷新频道列表，并确保首个频道的首屏数据已加载；
 * - 按 TLS 策略决定使用 WS 或降级为 polling，并完成连接/复用。
 *
 * 约定：
 * - 注释中文；日志英文（由 deps.logger 输出）。
 */

import type { ChatEventsConnectOptions } from "@/features/chat/domain/ports/chatEventsPort";
import type { WsEventDto } from "@/features/chat/domain/types/chatWireEvents";
import type { LiveChatPollingFallbackController } from "./liveChatPollingFallback";
import type { LiveChatWsManager } from "./liveChatWsManager";

type LoggerLike = {
  info(message: string, payload?: Record<string, unknown>): void;
};

type SessionListenerStopper = (() => void) | null;
type AutoRefreshStopper = (() => void) | null;

/**
 * 就绪编排器（ensureChatReady）的依赖集合。
 */
export type LiveChatEnsureReadyDeps = {
  /**
   * 日志端口（日志内容要求英文）。
   */
  logger: LoggerLike;
  /**
   * 获取当前 server socket 与可用 access token（均为 trim 后）。
   */
  getSocketAndValidToken: () => Promise<[string, string]>;
  /**
   * 刷新频道列表与未读计数。
   */
  refreshChannels: () => Promise<void>;
  /**
   * 加载某频道首屏消息。
   */
  loadChannelMessages: (cid: string) => Promise<void>;
  /**
   * 刷新成员侧栏（尽力而为）。
   */
  refreshMembersRail: (cid: string) => Promise<void>;
  /**
   * 读取当前频道 id。
   */
  getCurrentChannelId: () => string;
  /**
   * 设置当前频道 id（当尚未选择时）。
   */
  setCurrentChannelIdIfEmpty: () => void;
  /**
   * 获取 TLS 配置（用于判断 WS 是否可用）。
   */
  getTlsPolicyForSocket: (socketKey: string) => string;
  /**
   * 将 socket 映射为 HTTP origin（用于判断 https）。
   */
  toHttpOrigin: (socketKey: string) => string;
  /**
   * 获取 WS url override（来自 `/api/server` 的 `ws_url`）。
   */
  getWsUrlOverride: (socketKey: string) => string | undefined;
  /**
   * WS 连接管理器。
   */
  wsManager: LiveChatWsManager;
  /**
   * polling 降级控制器。
   */
  polling: LiveChatPollingFallbackController | null;
  /**
   * stopPolling 的统一出口（幂等）。
   */
  stopPolling: () => void;
  /**
   * 绑定自动刷新（返回 stopper）。
   */
  startAutoRefresh: (socketKey: string) => { stop: () => void };
  /**
   * 订阅 session 变更（返回 stopper）。
   */
  onAuthSessionChanged: (socketKey: string, listener: (session: { accessToken?: string } | null) => void) => () => void;
  /**
   * 获取当前 stopAutoRefresh handle。
   */
  getStopAutoRefresh: () => AutoRefreshStopper;
  /**
   * 设置 stopAutoRefresh handle。
   */
  setStopAutoRefresh: (stopper: AutoRefreshStopper) => void;
  /**
   * 获取当前 stopSessionListener handle。
   */
  getStopSessionListener: () => SessionListenerStopper;
  /**
   * 设置 stopSessionListener handle。
   */
  setStopSessionListener: (stopper: SessionListenerStopper) => void;
  /**
   * WS 事件处理回调（连接时注入）。
   */
  onWsEvent: (evt: WsEventDto) => void;
  /**
   * WS resume 失败回调（触发 HTTP 补拉）。
   */
  onResumeFailed: (socketKey: string, reason: string) => void;
};

/**
 * 创建“ensureChatReady”就绪编排函数。
 *
 * @param deps - 依赖注入。
 * @returns `ensureChatReady`。
 */
export function createLiveChatEnsureReady(deps: LiveChatEnsureReadyDeps) {
  /**
   * 确保当前 server 的聊天数据与 WS/轮询链路已就绪。
   *
   * 说明：
   * - 该函数可被重复调用（幂等/可重入的“尽力而为”语义）。
   * - 发生鉴权错误时会触发重连（通过 onAuthError 回调内再次调用）。
   *
   * @returns Promise<void>。
   */
  async function ensureChatReady(): Promise<void> {
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) return;

    // 为当前 socket 绑定一次“自动刷新 token + WS reauth”。
    if (!deps.getStopAutoRefresh()) deps.setStopAutoRefresh(deps.startAutoRefresh(socket).stop);
    if (!deps.getStopSessionListener()) {
      deps.setStopSessionListener(
        deps.onAuthSessionChanged(socket, (s) => {
          const next = s?.accessToken ?? "";
          deps.wsManager.reauthIfConnectedFor(socket, next);
        }),
      );
    }

    await deps.refreshChannels();

    deps.setCurrentChannelIdIfEmpty();
    const cid = deps.getCurrentChannelId();
    if (cid) {
      await deps.loadChannelMessages(cid);
      void deps.refreshMembersRail(cid);
    }

    const key = socket;
    const tlsPolicy = deps.getTlsPolicyForSocket(key);
    const origin = deps.toHttpOrigin(key);
    const shouldDisableWs = origin.startsWith("https://") && tlsPolicy !== "strict";

    if (shouldDisableWs) {
      // WebView WebSocket 无法绕过证书校验；此处降级为 HTTP 轮询。
      deps.wsManager.close();
      if (deps.polling && deps.polling.isRunningFor(key)) return;
      deps.stopPolling();
      deps.logger.info("Action: chat_ws_disabled_polling_fallback_started", { socket: key, tlsPolicy, origin });
      deps.polling?.start(key);
      return;
    }

    // TLS strict（或非 HTTPS）模式：使用 WS。
    deps.stopPolling();
    if (deps.wsManager.isConnectedFor(key)) return;
    const wsUrlOverride = deps.getWsUrlOverride(key);
    deps.logger.info("Action: chat_ws_connect_started", { socket: key, wsUrlOverride: wsUrlOverride ?? "" });

    const options: ChatEventsConnectOptions = {
      wsUrlOverride,
      onResumeFailed: (reason) => {
        deps.onResumeFailed(key, reason);
      },
      onAuthError: () => {
        deps.wsManager.close();
        void ensureChatReady();
      },
    };
    deps.wsManager.ensureConnected(key, token, deps.onWsEvent, options);
  }

  return ensureChatReady;
}
