/**
 * @fileoverview authSessionManager.ts
 * @description Session-level helper for access token refresh + WS reauth coordination.
 *
 * API reference:
 * - See `docs/api/*` for auth refresh/revoke and WS reauth semantics.
 *
 * Design goals:
 * - Keep feature layers clean: chat/features should not import auth/data directly.
 * - Avoid duplicated refresh storms: singleflight per server socket.
 * - Provide a minimal, documentable surface for “get a valid token” and “auto refresh”.
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
 * Notify session listeners for a server socket.
 *
 * @param serverSocket - Server socket key.
 * @param session - Updated session or null.
 */
function emitSession(serverSocket: string, session: AuthSession | null): void {
  const key = serverSocket.trim();
  const set = tokenListeners.get(key);
  if (!set || set.size === 0) return;
  for (const fn of set) {
    try {
      fn(session);
    } catch {
      // Listener failures must not break token propagation.
    }
  }
}

/**
 * Subscribe to session changes for a server socket.
 *
 * @param serverSocket - Server socket key.
 * @param listener - Listener callback.
 * @returns Unsubscribe function.
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
 * Compute whether a session is “close to expiry”.
 *
 * @param session - Stored session.
 * @param nowMs - Current time in ms.
 * @returns True if should refresh soon.
 */
function shouldRefreshSoon(session: AuthSession, nowMs: number): boolean {
  const expiresAt = typeof session.expiresAtMs === "number" ? session.expiresAtMs : undefined;
  if (!expiresAt) return false;
  const skewMs = 60_000;
  return expiresAt <= nowMs + skewMs;
}

/**
 * Perform `POST /api/auth/refresh` using the stored refresh token.
 *
 * @param serverSocket - Server socket.
 * @param refreshToken - Refresh token.
 * @returns Next session or null when refresh fails.
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
      logger.warn("Refresh failed", { socket, reason: e.reason, status: e.status });
    } else {
      logger.warn("Refresh failed", { socket, error: String(e) });
    }
    return null;
  }
}

/**
 * Ensure the stored session has a valid (non-expiring) access token.
 *
 * Behavior:
 * - If the session is missing: returns `null`.
 * - If the session is near expiry: refreshes it via HTTP and updates localStorage.
 * - Uses singleflight to avoid concurrent refresh storms.
 *
 * @param serverSocket - Server socket.
 * @returns Updated session or null.
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
 * Ensure a usable access token, returning the latest token string.
 *
 * @param serverSocket - Server socket.
 * @returns Access token or empty string.
 */
export async function ensureValidAccessToken(serverSocket: string): Promise<string> {
  const session = await ensureValidAuthSession(serverSocket);
  return session?.accessToken ?? "";
}

/**
 * Start an auto-refresh loop for a server socket.
 *
 * This schedules refresh shortly before expiry. On refresh success it updates
 * localStorage and emits to subscribers (WS can reauth).
 *
 * @param serverSocket - Server socket.
 * @returns Handle that can stop the loop.
 */
export function startAuthSessionAutoRefresh(serverSocket: string): AutoRefreshHandle {
  const socket = serverSocket.trim();
  if (!socket) return { stop: () => void 0 };

  /**
   * Clear any existing timer for this socket.
   */
  function clearTimer(): void {
    const t = autoRefreshTimers.get(socket);
    if (typeof t === "number") window.clearTimeout(t);
    autoRefreshTimers.delete(socket);
  }

  /**
   * Schedule the next refresh tick based on stored session.
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
    logger.debug("Auto refresh scheduled", { socket, delayMs });
  }

  scheduleNext();

  return {
    stop(): void {
      clearTimer();
    },
  };
}

/**
 * Best-effort revoke refresh token for a stored session and clear it locally.
 *
 * @param serverSocket - Server socket.
 * @returns Promise<void>
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
      logger.warn("Revoke failed (best-effort)", { socket, reason: e.reason, status: e.status });
      return;
    }
    logger.warn("Revoke failed (best-effort)", { socket, error: String(e) });
  }
}
