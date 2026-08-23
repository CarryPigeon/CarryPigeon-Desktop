/**
 * @fileoverview 聊天事件流 WebSocket 客户端。
 * @description chat｜数据层实现：wsChatEvents。
 * 用于连接服务端 `/api/ws`，完成鉴权（`auth/reauth`）、心跳（`ping`）与事件接收（`event`）。
 *
 * 文档对齐：
 * - `docs/api/10-HTTP+WebSocket协议（v1，标准版）.md`
 * - `docs/api/12-WebSocket事件清单（v1，标准版）.md`
 */

import { getDevProxiedWsUrl, shouldUseDevApiProxy } from "@/shared/net/http/devApiProxy";
import { toHttpOrigin } from "@/shared/net/http/serverOrigin";
import { compareEventId } from "@/shared/net/ws/eventId";
import { getDeviceId } from "@/shared/utils/deviceId";
import { createLogger } from "@/shared/utils/logger";
import { readLastEventId, writeLastEventId } from "@/shared/utils/localState";
import { USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { connectProtocolMockChatWs } from "@/shared/mock/protocol/protocolMockTransport";
import { getKnownServerId, rememberServerId } from "@/shared/serverIdentity";
import { getWsConnectionPool } from "./wsConnectionPool";
import type { ChatWsEventWire } from "../protocol/chatWireEvents";

/**
 * WS 事件模块日志器。
 */
const logger = createLogger("wsChatEvents");

/**
 * 心跳间隔（毫秒）。
 */
const PING_INTERVAL_MS = 30_000;

/**
 * 判定半开链路所需的无入站帧时长（毫秒）。
 *
 * 约 2.5 个心跳周期；健康链路每 30s 至少收到一次 pong。
 */
const PONG_DEAD_TIMEOUT_MS = 75_000;

/**
 * 触发半开判定所需的“发出 ping 却无任何入站帧”的最少次数。
 */
const PING_DEAD_THRESHOLD = 2;

/**
 * 连续多少次“未能完成认证即断开”后视为连接丢失（触发降级回调）。
 */
const CONNECTION_LOST_THRESHOLD = 3;

/**
 * 服务端事件 envelope（`type=event`）。
 */
export type WsEventEnvelope = {
  type: "event";
  data: ChatWsEventWire;
};

/**
 * 命令成功响应（`*.ok`）。
 */
export type WsCommandOk = {
  type: string;
  id?: string;
  data?: unknown;
};

/**
 * 命令失败响应（`*.err`）。
 */
export type WsCommandErr = {
  type: string;
  id?: string;
  error?: { reason?: string; message?: string };
};

/**
 * 断点续传（resume）失败响应（服务端无法回放事件）。
 */
export type WsResumeFailed = {
  type: "resume.failed";
  data?: { reason?: string };
};

/**
 * 入站消息联合类型。
 */
export type WsInbound = WsEventEnvelope | WsCommandOk | WsCommandErr;

/**
 * WS 客户端句柄。
 */
export type ChatWsClient = {
  close(): void;
  reauth(nextAccessToken: string): void;
};

/**
 * WS 连接选项。
 */
export type ChatWsConnectOptions = {
  /**
   * 服务端 `GET /api/server` 返回的可选 `ws_url`。
   *
   * 当提供该字段时，优先使用它，而不是 `${origin}/api/ws`。
   */
  wsUrlOverride?: string;
  /**
   * 当服务端返回 `resume.failed` 时回调。
   *
   * 约定：客户端必须走 HTTP 补拉（频道列表 / 未读 / 消息列表）。
   */
  onResumeFailed?: (reason: string) => void;
  /**
   * 当服务端拒绝 `auth/reauth`（例如 token 过期）时回调。
   */
  onAuthError?: (reason: string) => void;
  /**
   * 连接持续失败（连续多次未能完成认证即断开）时回调一次。
   *
   * 语义：上层应据此启动降级（如 HTTP polling）；同一段失败期内只触发一次。
   */
  onConnectionLost?: () => void;
  /**
   * 处于 lost 态的连接重新认证成功时回调一次。
   *
   * 语义：上层应据此停止降级（如停止 polling）。
   */
  onConnectionRestored?: () => void;
};

/**
 * 将 HTTP origin 转换为 WS origin。
 *
 * @param httpOrigin - 例如 `https://host:port`。
 * @returns 例如 `wss://host:port`。
 */
function toWsOrigin(httpOrigin: string): string {
  const origin = httpOrigin.trim();
  if (origin.startsWith("https://")) return `wss://${origin.slice("https://".length)}`;
  if (origin.startsWith("http://")) return `ws://${origin.slice("http://".length)}`;
  return origin;
}

/**
 * 归一化服务端返回的 WS URL override。
 *
 * 支持输入：
 * - `wss://host/api/ws`（服务端返回，且必须与登录 origin 同主机）
 * - `https://host/api/ws`（尽力转换为 wss，同样要求同主机）
 * - `/api/ws`（相对路径，基于 socket 推导出的 origin 拼接）
 *
 * 安全约束：
 * - 明文 `ws:` / `http:` 一律拒绝（access_token 会明文上网）；
 * - 绝对地址必须与登录推导的 origin 同主机（含端口），防止被入侵的服务器
 *   把 token 与事件流重定向到第三方收集端点。
 *
 * @param raw - 原始 override 字符串。
 * @param wsOrigin - 推导出的 ws(s) origin（用于拼接相对路径与同主机校验）。
 * @returns 归一化后的 ws(s) URL；非法时返回空字符串（调用方回退默认 origin）。
 */
function normalizeWsUrlOverride(raw: string, wsOrigin: string): string {
  const v = String(raw ?? "").trim();
  if (!v) return "";
  if (v.startsWith("/")) return `${wsOrigin}${v}`;
  try {
    const u = new URL(v);
    // 明文协议拒绝；https 提升为 wss。
    if (u.protocol === "http:") return "";
    if (u.protocol === "https:") {
      u.protocol = "wss:";
    }
    if (u.protocol !== "wss:") return "";
    // 同主机校验（host 含端口，忽略大小写）。
    const base = new URL(wsOrigin);
    if (u.host.toLowerCase() !== base.host.toLowerCase()) return "";
    return u.toString();
  } catch {
    return "";
  }
}

/**
 * 生成 WS 命令请求 id（用于请求/响应关联）。
 *
 * @returns 请求 id。
 */
function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * 计算下一次重连延迟（指数退避 + 少量抖动）。
 *
 * @param attempt - 当前重连次数（从 1 开始）。
 * @returns 延迟毫秒数。
 */
function computeReconnectDelayMs(attempt: number): number {
  const n = Math.max(1, Math.trunc(attempt));
  const base = 1000;
  const max = 30_000;
  const delay = Math.min(max, base * 2 ** Math.min(6, n - 1));
  const jitter = Math.trunc(Math.random() * 250);
  return delay + jitter;
}

/**
 * 连接聊天 WS 并完成鉴权。
 *
 * @param serverSocket - 服务器 Socket 地址（用于推导 origin）。
 * @param accessToken - `auth` 使用的 access_token。
 * @param onEvent - 事件回调（仅服务端事件 envelope）。
 * @param options - 可选扩展回调与覆盖项。
 * @returns 客户端句柄。
 */
export function connectChatWs(
  serverSocket: string,
  accessToken: string,
  onEvent: (env: WsEventEnvelope) => void,
  options?: ChatWsConnectOptions,
): ChatWsClient {
  if (USE_MOCK_TRANSPORT) {
    return connectProtocolMockChatWs(serverSocket, accessToken, onEvent, options);
  }
  const socket = serverSocket.trim();
  let token = accessToken.trim();
  if (!socket) throw new Error("缺少 server socket");
  if (!token) throw new Error("缺少 access token");

  const origin = toHttpOrigin(socket);
  if (!origin) throw new Error("无法解析 server origin");
  const wsOrigin = toWsOrigin(origin);
  const proxiedWsUrl = shouldUseDevApiProxy(socket) ? getDevProxiedWsUrl() : "";
  const wsUrl =
    proxiedWsUrl ||
    normalizeWsUrlOverride(options?.wsUrlOverride ?? "", wsOrigin) ||
    `${wsOrigin}/api/ws`;

  let ws: WebSocket | null = null;
  let pingTimer: number | null = null;
  let reconnectTimer: number | null = null;
  let reconnectAttempt = 0;
  let closedByUser = false;
  /** 当前连接是否已完成过认证（auth.ok / reauth.ok）。 */
  let hasAuthenticated = false;
  /** 连续“未完成认证即断开”的次数（用于判定连接丢失并触发降级回调）。 */
  let consecutiveConnectFailures = 0;
  /**
   * 是否已通知上层“连接丢失”。
   *
   * 同一段失败期内只通知一次；重新认证成功后复位并通知恢复。
   */
  let connectionLostNotified = false;
  /** 最近一次收到入站帧的时间戳（毫秒），用于半开链路判活。 */
  let lastInboundAt = 0;
  /** 自最近一次入站帧以来已发出但未获任何回应的 ping 次数。 */
  let pingsSinceInbound = 0;

  /**
   * 停止心跳定时器。
   *
   * @returns 无返回值。
   */
  function stopPing(): void {
    if (!pingTimer) return;
    window.clearInterval(pingTimer);
    pingTimer = null;
  }

  /**
   * 停止重连定时器。
   *
   * @returns 无返回值。
   */
  function stopReconnect(): void {
    if (!reconnectTimer) return;
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  /**
   * 启动 WS 心跳：每 30 秒发送一次 `ping`，并用 pong 判活检测半开链路。
   *
   * 判活规则：连续 ≥ `PING_DEAD_THRESHOLD` 个 ping 未获得任何入站帧，
   * 且距最近入站帧超过 `PONG_DEAD_TIMEOUT_MS`，即主动关闭连接
   * （close 事件会负责清理与退避重连），避免睡眠唤醒/断网后的死链路静默。
   *
   * @returns 无返回值。
   */
  function startPing(): void {
    stopPing();
    lastInboundAt = Date.now();
    pingsSinceInbound = 0;
    pingTimer = window.setInterval(() => {
      pingsSinceInbound += 1;
      try {
        ws?.send(JSON.stringify({ type: "ping" }));
      } catch {
        // 忽略发送失败；close 事件会负责清理与重连。
      }
      const idleMs = Date.now() - lastInboundAt;
      if (pingsSinceInbound >= PING_DEAD_THRESHOLD && idleMs > PONG_DEAD_TIMEOUT_MS) {
        logger.warn("Action: chat_ws_ping_timeout_detected", {
          wsUrl,
          pingsSinceInbound,
          idleMs,
        });
        try {
          ws?.close();
        } catch {
          // 忽略关闭异常；close 事件随后触发重连。
        }
      }
    }, PING_INTERVAL_MS);
  }

  /**
   * 标记当前连接已完成认证，并按需通知“连接恢复”。
   *
   * @returns 无返回值。
   */
  function markAuthenticated(): void {
    hasAuthenticated = true;
    consecutiveConnectFailures = 0;
    if (connectionLostNotified) {
      connectionLostNotified = false;
      logger.info("Action: chat_ws_connection_restored", { wsUrl });
      try {
        options?.onConnectionRestored?.();
      } catch (error) {
        logger.warn("Action: chat_ws_connection_restored_callback_failed", {
          wsUrl,
          error: String(error),
        });
      }
    }
  }

  /**
   * 在当前连接上发送 `auth` 命令。
   *
   * 重要约定：`resume.last_event_id` 必须是“最后已处理事件”的 `event_id`。
   *
   * @returns 无返回值。
   */
  async function sendAuth(): Promise<void> {
    const id = createRequestId();
    const lastEventId = await readLastEventId(socket);
    const resume = lastEventId ? { last_event_id: lastEventId } : undefined;
    const msg = {
      type: "auth",
      id,
      data: {
        api_version: 1,
        access_token: token,
        device_id: getDeviceId(),
        resume,
      },
    };
    logger.info("Action: chat_ws_auth_opened", { wsUrl, hasResume: Boolean(lastEventId) });
    ws?.send(JSON.stringify(msg));
    startPing();
  }

  /**
   * 处理一条入站 WS 消息（原始 frame）。
   *
   * @param evt - WS message event。
   */
  function handleMessage(evt: MessageEvent): void {
    const raw = String(evt.data ?? "");
    if (!raw) return;
    // 任何入站帧（含 pong）都证明链路存活，重置半开判活窗口。
    lastInboundAt = Date.now();
    pingsSinceInbound = 0;
    let parsed: WsInbound | null = null;
    try {
      parsed = JSON.parse(raw) as WsInbound;
    } catch {
      return;
    }

    if (parsed && typeof parsed === "object" && parsed.type === "resume.failed") {
      const msg = parsed as WsResumeFailed;
      const reason = String(msg.data?.reason ?? "").trim() || "resume_failed";
      logger.warn("Action: chat_ws_resume_failed", { wsUrl, reason });
      writeLastEventId(socket, "");
      options?.onResumeFailed?.(reason);
      return;
    }

    if (parsed && typeof parsed === "object" && parsed.type === "event") {
      const env = parsed as WsEventEnvelope;
      const eid = String(env.data?.event_id ?? "").trim();
      if (!eid) {
        logger.warn("Action: chat_ws_event_missing_event_id_ignored", { wsUrl, eventType: String(env.data?.event_type ?? "").trim() });
        return;
      }

      const last = readLastEventId(socket);
      const trimmedLast = last.trim();
      if (trimmedLast && compareEventId(eid, trimmedLast) <= 0) {
        logger.debug("Action: chat_ws_event_ignored_duplicate_or_out_of_order", {
          wsUrl,
          eid,
          last: trimmedLast,
          eventType: String(env.data?.event_type ?? "").trim(),
        });
        return;
      }

      try {
        onEvent(env);
      } catch (e) {
        // 重要：消费端失败时，不能前移 last_event_id，否则会丢事件。
        logger.error("Action: chat_ws_event_handler_failed_kept_last_event_id", {
          wsUrl,
          eid,
          eventType: String(env.data?.event_type ?? "").trim(),
          error: String(e),
        });
        return;
      }

      writeLastEventId(socket, eid);
      return;
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as WsCommandErr).error === "object" &&
      (parsed as WsCommandErr).error !== null
    ) {
      const e = parsed as WsCommandErr;
      logger.warn("Action: chat_ws_command_failed", { type: e.type, id: e.id ?? "", reason: e.error?.reason ?? "" });
      if (e.type === "auth.err" || e.type === "reauth.err") {
        const reason = String(e.error?.reason ?? "").trim() || "unauthorized";
        if (e.type === "auth.err" && !hasAuthenticated) {
          // 首次认证失败：主动关闭当前连接，让退避重连用（可能已更新的）token 重新认证，
          // 避免在一条未注册的链路上静默保活、永远收不到事件。
          logger.warn("Action: chat_ws_auth_failed_closing_socket", { wsUrl, reason });
          try {
            ws?.close();
          } catch {
            // 忽略关闭异常；close 事件随后触发重连。
          }
        }
        options?.onAuthError?.(reason);
      }
      return;
    }

    const ok = parsed as WsCommandOk;
    logger.debug("Action: chat_ws_message_received", { type: ok.type, id: ok.id ?? "" });

    if (ok.type === "auth.ok" || ok.type === "reauth.ok") {
      markAuthenticated();
    }

    // 兜底恢复 `server_id`：服务端在 `auth.ok` 帧中回显 `data.server_id`。
    // 当 `GET /api/server` 因某条路径被跳过或失败时，这里作为恢复作用域隔离的备用来源；
    // 仅在当前未知 `server_id` 时填入，不覆盖已建立的作用域，避免迁移副作用。
    if (ok.type === "auth.ok" && ok.data && typeof ok.data === "object") {
      const dataRecord = ok.data as Record<string, unknown>;
      const serverId = typeof dataRecord.server_id === "string" ? dataRecord.server_id.trim() : "";
      if (serverId && !getKnownServerId(socket)) {
        rememberServerId(socket, serverId);
        logger.info("Action: chat_ws_auth_ok_server_id_recovered", { socket, serverId });
      }
    }
  }

  /**
   * 当连接非预期关闭时，按退避策略计划重连。
   *
   * @returns 无返回值。
   */
  function scheduleReconnect(): void {
    if (closedByUser) return;
    stopReconnect();
    reconnectAttempt += 1;
    const delayMs = computeReconnectDelayMs(reconnectAttempt);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delayMs);
    logger.warn("Action: chat_ws_reconnect_scheduled", { wsUrl, attempt: reconnectAttempt, delayMs });
  }

  /**
   * 创建新的 WebSocket 实例并绑定事件监听。
   *
   * @returns 无返回值。
   */
  let openHandler: (() => void) | null = null;
  let closeHandler: (() => void) | null = null;
  let errorHandler: (() => void) | null = null;

  function connect(): void {
    stopPing();
    if (ws) {
      if (openHandler) ws.removeEventListener("open", openHandler);
      ws.removeEventListener("message", handleMessage);
      if (closeHandler) ws.removeEventListener("close", closeHandler);
      if (errorHandler) ws.removeEventListener("error", errorHandler);
      try {
        ws.close();
      } catch {
        // 忽略关闭异常；本次连接即将被替换。
      }
    }

    ws = new WebSocket(wsUrl);

    openHandler = () => {
      reconnectAttempt = 0;
      void sendAuth().catch((error) => {
        logger.warn("Action: chat_ws_auth_failed_last_event_load_failed", { wsUrl, error: String(error) });
      });
    };
    closeHandler = () => {
      stopPing();
      logger.warn("Action: chat_ws_connection_closed", { wsUrl, authenticated: hasAuthenticated });
      if (!hasAuthenticated) {
        // 本轮连接从未完成认证即断开：计入连续失败，达到阈值时通知上层降级。
        consecutiveConnectFailures += 1;
        if (consecutiveConnectFailures >= CONNECTION_LOST_THRESHOLD && !connectionLostNotified) {
          connectionLostNotified = true;
          logger.warn("Action: chat_ws_connection_lost", {
            wsUrl,
            consecutiveConnectFailures,
          });
          try {
            options?.onConnectionLost?.();
          } catch (error) {
            logger.warn("Action: chat_ws_connection_lost_callback_failed", {
              wsUrl,
              error: String(error),
            });
          }
        }
      }
      hasAuthenticated = false;
      scheduleReconnect();
    };
    errorHandler = () => {
      logger.warn("Action: chat_ws_receive_failed", { wsUrl });
    };

    ws.addEventListener("open", openHandler);
    ws.addEventListener("message", handleMessage);
    ws.addEventListener("close", closeHandler);
    ws.addEventListener("error", errorHandler);
  }

  connect();

  // 将连接注册到全局连接池，统一监控和统计
  const pool = getWsConnectionPool();
  pool.registerConnection(socket, { close, reauth });

  /**
   * 使用最新 access_token 发送 `reauth` 命令。
   *
   * @param nextAccessToken - 新的 access_token。
   */
  function reauth(nextAccessToken: string): void {
    const next = String(nextAccessToken ?? "").trim();
    if (!next) return;
    token = next;
    try {
      ws?.send(JSON.stringify({ type: "reauth", id: createRequestId(), data: { access_token: token } }));
    } catch {
      // 尽力而为：reauth 失败并不致命，重连后会重新 auth。
    }
  }

  /**
   * 主动关闭连接并停止所有定时器。
   *
   * @returns 无返回值。
   */
  function close(): void {
    pool.unregisterConnection(socket);
    closedByUser = true;
    stopPing();
    stopReconnect();
    try {
      ws?.close();
    } catch {
      // 忽略关闭异常。
    }
    ws = null;
  }

  return {
    close,
    reauth,
  };
}
