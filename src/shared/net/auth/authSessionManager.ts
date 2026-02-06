/**
 * @fileoverview authSessionManager.ts
 * @description 网络基础设施：authSessionManager。
 *
 * API 参考：
 * - 见 `docs/api/*`：auth refresh/revoke 以及 WS reauth 语义。
 *
 * 设计目标：
 * - 保持 feature 分层干净：chat/features 不直接依赖 auth/data。
 * - 避免重复刷新风暴：按 server socket 做 singleflight。
 * - 提供最小、可文档化的能力面：获取可用 token 与自动刷新。
 */

import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";
import { createLogger } from "@/shared/utils/logger";
import { getDeviceId } from "@/shared/utils/deviceId";
import { readAuthSession, writeAuthSession, type AuthSession } from "@/shared/utils/localState";
import { isApiRequestError } from "@/shared/net/http/apiErrors";

const logger = createLogger("authSessionManager");

type ApiTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  uid: string;
};

type AutoRefreshHandle = {
  stop(): void;
};

const refreshSingleflight = new Map<string, Promise<AuthSession | null>>();
const tokenListeners = new Map<string, Set<(session: AuthSession | null) => void>>();
const autoRefreshTimers = new Map<string, number>();

/**
 * 通知指定 server socket 的 session 监听者。
 *
 * @param serverSocket - 服务器 Socket 地址（作为监听 key）。
 * @param session - 更新后的 session；若为 null 表示清空。
 */
function emitSession(serverSocket: string, session: AuthSession | null): void {
  const key = serverSocket.trim();
  const set = tokenListeners.get(key);
  if (!set || set.size === 0) return;
  for (const fn of set) {
    try {
      fn(session);
    } catch {
      // 监听者异常不得影响 token 传播。
    }
  }
}

/**
 * 订阅指定 server socket 的 session 变更。
 *
 * @param serverSocket - 服务器 Socket 地址（作为监听 key）。
 * @param listener - 监听回调。
 * @returns 取消订阅函数。
 */
export function onAuthSessionChanged(
  serverSocket: string,
  listener: (session: AuthSession | null) => void,
): () => void {
  const key = serverSocket.trim();
  if (!key) return () => void 0;
  const set = tokenListeners.get(key) ?? new Set<(session: AuthSession | null) => void>();
  set.add(listener);
  tokenListeners.set(key, set);
  return () => {
    const current = tokenListeners.get(key);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) tokenListeners.delete(key);
  };
}

/**
 * 判断 session 是否“临近过期”（需要尽快刷新）。
 *
 * @param session - 已存储的 session。
 * @param nowMs - 当前时间（ms）。
 * @returns 需要尽快刷新时返回 true。
 */
function shouldRefreshSoon(session: AuthSession, nowMs: number): boolean {
  const expiresAt = typeof session.expiresAtMs === "number" ? session.expiresAtMs : undefined;
  if (!expiresAt) return false;
  const skewMs = 60_000;
  return expiresAt <= nowMs + skewMs;
}

/**
 * 使用已存储的 refresh token 执行 `POST /api/auth/refresh`。
 *
 * @param serverSocket - 服务端 socket。
 * @param refreshToken - refresh token。
 * @returns 刷新成功返回新 session；失败返回 null。
 */
async function refreshViaHttp(serverSocket: string, refreshToken: string): Promise<AuthSession | null> {
  const socket = serverSocket.trim();
  const rt = refreshToken.trim();
  if (!socket || !rt) return null;

  const client = new HttpJsonClient({ serverSocket: socket, apiVersion: 1 });
  try {
    const res = await client.requestJson<ApiTokenResponse>("POST", "/auth/refresh", {
      refresh_token: rt,
      client: { device_id: getDeviceId() },
    });
    const accessToken = String(res.access_token ?? "").trim();
    const nextRefreshToken = String(res.refresh_token ?? "").trim();
    const expiresInSec = Number(res.expires_in ?? 0);
    const uid = String(res.uid ?? "").trim();
    if (!accessToken || !nextRefreshToken) throw new Error("Missing token fields");

    const expiresAtMs = Date.now() + Math.max(0, Math.trunc(Number.isFinite(expiresInSec) ? expiresInSec : 0)) * 1000;
    return { accessToken, refreshToken: nextRefreshToken, uid: uid || undefined, expiresAtMs };
  } catch (e) {
    if (isApiRequestError(e)) {
      logger.warn("Action: auth_refresh_failed", { socket, reason: e.reason, status: e.status });
    } else {
      logger.warn("Action: auth_refresh_failed", { socket, error: String(e) });
    }
    return null;
  }
}

/**
 * 确保本地存储的 session 持有“可用的（未临近过期）”access token。
 *
 * 行为：
 * - 若 session 不存在：返回 `null`。
 * - 若 session 临近过期：通过 HTTP 刷新，并更新 localStorage。
 * - 使用 singleflight 避免并发刷新风暴。
 *
 * @param serverSocket - 服务端 socket。
 * @returns 更新后的 session；若不存在则为 null。
 */
export async function ensureValidAuthSession(serverSocket: string): Promise<AuthSession | null> {
  const socket = serverSocket.trim();
  if (!socket) return null;

  const current = readAuthSession(socket);
  if (!current) return null;
  if (!current.refreshToken) return current;

  const nowMs = Date.now();
  if (!shouldRefreshSoon(current, nowMs)) return current;

  const inflight = refreshSingleflight.get(socket);
  if (inflight) return inflight;

  const p = (async () => {
    const next = await refreshViaHttp(socket, current.refreshToken);
    if (!next) return current;
    writeAuthSession(socket, next);
    emitSession(socket, next);
    return next;
  })().finally(() => {
    refreshSingleflight.delete(socket);
  });

  refreshSingleflight.set(socket, p);
  return p;
}

/**
 * 确保存在可用 access token，并返回最新 token 字符串。
 *
 * @param serverSocket - 服务端 socket。
 * @returns access token；若不可用则返回空字符串。
 */
export async function ensureValidAccessToken(serverSocket: string): Promise<string> {
  const session = await ensureValidAuthSession(serverSocket);
  return session?.accessToken ?? "";
}

/**
 * 为指定 server socket 启动自动刷新循环。
 *
 * 说明：
 * - 会在过期前一段时间调度刷新；
 * - 刷新成功会更新 localStorage 并广播给订阅者（WS 可据此 reauth）。
 *
 * @param serverSocket - 服务端 socket。
 * @returns 可停止循环的 handle。
 */
export function startAuthSessionAutoRefresh(serverSocket: string): AutoRefreshHandle {
  const socket = serverSocket.trim();
  if (!socket) return { stop: () => void 0 };

  /**
   * 清理该 socket 的既有 timer（若存在）。
   */
  function clearTimer(): void {
    const t = autoRefreshTimers.get(socket);
    if (typeof t === "number") window.clearTimeout(t);
    autoRefreshTimers.delete(socket);
  }

  /**
   * 基于本地存储 session 调度下一次刷新 tick。
   */
  function scheduleNext(): void {
    clearTimer();
    const session = readAuthSession(socket);
    if (!session?.refreshToken) return;

    const nowMs = Date.now();
    const expiresAt = typeof session.expiresAtMs === "number" ? session.expiresAtMs : nowMs + 10 * 60_000;
    const skewMs = 60_000;
    const delayMs = Math.max(5_000, Math.trunc(expiresAt - nowMs - skewMs));

    const id = window.setTimeout(async () => {
      autoRefreshTimers.delete(socket);
      const next = await ensureValidAuthSession(socket);
      if (next) emitSession(socket, next);
      scheduleNext();
    }, delayMs);

    autoRefreshTimers.set(socket, id);
    logger.debug("Action: auth_auto_refresh_scheduled", { socket, delayMs });
  }

  scheduleNext();

  return {
    stop(): void {
      clearTimer();
    },
  };
}

/**
 * Best-effort：吊销本地 session 对应的 refresh token，并清空本地存储。
 *
 * @param serverSocket - 服务端 socket。
 * @returns Promise<void>。
 */
export async function revokeAndClearSession(serverSocket: string): Promise<void> {
  const socket = serverSocket.trim();
  if (!socket) return;

  const session = readAuthSession(socket);
  const refreshToken = session?.refreshToken ?? "";
  writeAuthSession(socket, null);
  emitSession(socket, null);

  if (!refreshToken) return;
  const client = new HttpJsonClient({ serverSocket: socket, apiVersion: 1 });
  try {
    await client.requestJson<void>("POST", "/auth/revoke", { refresh_token: refreshToken, client: { device_id: getDeviceId() } });
  } catch (e) {
    if (isApiRequestError(e)) {
      logger.warn("Action: auth_revoke_failed_best_effort", { socket, reason: e.reason, status: e.status });
      return;
    }
    logger.warn("Action: auth_revoke_failed_best_effort", { socket, error: String(e) });
  }
}
