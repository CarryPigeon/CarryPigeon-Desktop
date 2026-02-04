/**
 * @fileoverview 聊天事件流 WebSocket 客户端。
 * @description
 * 用于连接服务端 `/api/ws`，完成鉴权（`auth/reauth`）、心跳（`ping`）与事件接收（`event`）。
 *
 * 文档对齐：
 * - `docs/api/10-HTTP+WebSocket协议（v1，标准版）.md`
 * - `docs/api/12-WebSocket事件清单（v1，标准版）.md`
 */

import { toHttpOrigin } from "@/shared/net/http/serverOrigin";
import { compareEventId } from "@/shared/net/ws/eventId";
import { getDeviceId } from "@/shared/utils/deviceId";
import { createLogger } from "@/shared/utils/logger";
import { readLastEventId, writeLastEventId } from "@/shared/utils/localState";
import { USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { connectProtocolMockChatWs } from "@/shared/mock/protocol/protocolMockTransport";

/**
 * WS 事件模块日志器。
 */
const logger = createLogger("wsChatEvents");

/**
 * 服务端事件 envelope（`type=event`）。
 */
export type WsEventEnvelope = {
  type: "event";
  data: {
    event_id: string;
    event_type: string;
    server_time: number;
    payload: unknown;
  };
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
 * - `wss://host/api/ws`（服务端返回）
 * - `https://host/api/ws`（尽力转换为 wss）
 * - `/api/ws`（相对路径，基于 socket 推导出的 origin 拼接）
 *
 * @param raw - 原始 override 字符串。
 * @param wsOrigin - 推导出的 ws(s) origin（用于拼接相对路径）。
 * @returns 归一化后的 ws(s) URL；非法时返回空字符串。
 */
function normalizeWsUrlOverride(raw: string, wsOrigin: string): string {
  const v = String(raw ?? "").trim();
  if (!v) return "";
  if (v.startsWith("/")) return `${wsOrigin}${v}`;
  try {
    const u = new URL(v);
    if (u.protocol === "wss:" || u.protocol === "ws:") return u.toString();
    if (u.protocol === "https:") {
      u.protocol = "wss:";
      return u.toString();
    }
    if (u.protocol === "http:") {
      u.protocol = "ws:";
      return u.toString();
    }
    return "";
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
 * @param serverSocket - 服务器 socket（用于推导 origin）。
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
  const wsUrl = normalizeWsUrlOverride(options?.wsUrlOverride ?? "", wsOrigin) || `${wsOrigin}/api/ws`;

  let ws: WebSocket | null = null;
  let pingTimer: number | null = null;
  let reconnectTimer: number | null = null;
  let reconnectAttempt = 0;
  let closedByUser = false;

  /**
   * 停止心跳定时器。
   *
   * @returns void
   */
  function stopPing(): void {
    if (!pingTimer) return;
    window.clearInterval(pingTimer);
    pingTimer = null;
  }

  /**
   * 停止重连定时器。
   *
   * @returns void
   */
  function stopReconnect(): void {
    if (!reconnectTimer) return;
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  /**
   * 启动 WS 心跳：每 30 秒发送一次 `ping`。
   *
   * @returns void
   */
  function startPing(): void {
    stopPing();
    pingTimer = window.setInterval(() => {
      try {
        ws?.send(JSON.stringify({ type: "ping" }));
      } catch {
        // 忽略发送失败；close 事件会负责清理与重连。
      }
    }, 30_000);
  }

  /**
   * 在当前连接上发送 `auth` 命令。
   *
   * 重要约定：`resume.last_event_id` 必须是“最后已处理事件”的 `event_id`。
   *
   * @returns void
   */
  function sendAuth(): void {
    const id = createRequestId();
    const lastEventId = readLastEventId(socket);
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
    logger.info("WS open: auth", { wsUrl, hasResume: Boolean(lastEventId) });
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
    let parsed: WsInbound | null = null;
    try {
      parsed = JSON.parse(raw) as WsInbound;
    } catch {
      return;
    }

    if (parsed && typeof parsed === "object" && parsed.type === "resume.failed") {
      const msg = parsed as WsResumeFailed;
      const reason = String(msg.data?.reason ?? "").trim() || "resume_failed";
      logger.warn("WS resume failed", { wsUrl, reason });
      writeLastEventId(socket, "");
      options?.onResumeFailed?.(reason);
      return;
    }

    if (parsed && typeof parsed === "object" && parsed.type === "event") {
      const env = parsed as WsEventEnvelope;
      const eid = String(env.data?.event_id ?? "").trim();
      if (!eid) {
        logger.warn("WS event missing event_id; ignored", { wsUrl, eventType: String(env.data?.event_type ?? "").trim() });
        return;
      }

      const last = readLastEventId(socket).trim();
      if (last && compareEventId(eid, last) <= 0) {
        logger.debug("WS event ignored (duplicate/out-of-order)", {
          wsUrl,
          eid,
          last,
          eventType: String(env.data?.event_type ?? "").trim(),
        });
        return;
      }

      try {
        onEvent(env);
      } catch (e) {
        // 重要：消费端失败时，不能前移 last_event_id，否则会丢事件。
        logger.error("WS event handler failed; keeping last_event_id", {
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

    if (parsed && typeof parsed === "object" && typeof (parsed as WsCommandErr).error === "object") {
      const e = parsed as WsCommandErr;
      logger.warn("WS command error", { type: e.type, id: e.id ?? "", reason: e.error?.reason ?? "" });
      if (e.type === "auth.err" || e.type === "reauth.err") {
        const reason = String(e.error?.reason ?? "").trim() || "unauthorized";
        options?.onAuthError?.(reason);
      }
      return;
    }

    const ok = parsed as WsCommandOk;
    logger.debug("WS message", { type: ok.type, id: ok.id ?? "" });
  }

  /**
   * 当连接非预期关闭时，按退避策略计划重连。
   *
   * @returns void
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
    logger.warn("WS reconnect scheduled", { wsUrl, attempt: reconnectAttempt, delayMs });
  }

  /**
   * 创建新的 WebSocket 实例并绑定事件监听。
   *
   * @returns void
   */
  function connect(): void {
    stopPing();
    if (ws) {
      try {
        ws.close();
      } catch {
        // 忽略关闭异常；本次连接即将被替换。
      }
    }

    ws = new WebSocket(wsUrl);

    ws.addEventListener("open", () => {
      reconnectAttempt = 0;
      sendAuth();
    });

    ws.addEventListener("message", handleMessage);

    ws.addEventListener("close", () => {
      stopPing();
      logger.warn("WS closed", { wsUrl });
      scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      logger.warn("WS error", { wsUrl });
    });
  }

  connect();

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
   * @returns void
   */
  function close(): void {
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
