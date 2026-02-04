/**
 * @fileoverview 本地持久化的轻量状态（localStorage）。
 * @description 用于替代原先由 Rust/SQLite 提供的“业务游标/配置”等小数据存储。
 */

import { getServerScopeKey } from "@/shared/serverIdentity";

const KEY_LATEST_MESSAGE_TIME_MS = "carrypigeon:latestMessageTimeMs";
const KEY_APP_CONFIG_RAW = "carrypigeon:appConfigRaw";
const KEY_TOKEN_PREFIX = "carrypigeon:authToken:";
const KEY_SESSION_PREFIX = "carrypigeon:authSession:";
const KEY_LAST_EVENT_ID_PREFIX = "carrypigeon:lastEventId:";

export type AuthSession = {
  /**
   * 访问令牌（access token：bearer token，用于 HTTP Authorization 与 WS auth）。
   */
  accessToken: string;
  /**
   * 刷新令牌（refresh token）：用于 `POST /api/auth/refresh` 与 `POST /api/auth/revoke`。
   */
  refreshToken: string;
  /**
   * 当前用户 id（Snowflake 字符串）。
   * 说明：会话可能先被恢复，再去拉取用户信息，因此该字段可选。
   */
  uid?: string;
  /**
   * 访问令牌（access token）过期时间戳（epoch ms，best-effort 提示）。
   */
  expiresAtMs?: number;
};

/**
 * 将字符串解析为有限数值。
 *
 * @param value - localStorage 原始字符串值。
 * @returns 解析后为有限数值则返回 number；否则返回 `null`。
 */
function safeParseNumber(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 读取本地已知的最新消息时间戳（毫秒）。
 *
 * 说明：该值可作为轻量游标，为未来的增量拉取提供基础能力。
 *
 * @returns 最新时间戳（ms）；不可用时返回 0。
 */
export function getLatestLocalMessageTimeMs(): number {
  return safeParseNumber(localStorage.getItem(KEY_LATEST_MESSAGE_TIME_MS)) ?? 0;
}

/**
 * 使用 max() 策略更新本地最新消息时间戳。
 *
 * @param next - 候选时间戳（ms）；非有限值或不更新则忽略。
 */
export function bumpLatestLocalMessageTimeMs(next: number): void {
  if (!Number.isFinite(next) || next <= 0) return;
  const current = getLatestLocalMessageTimeMs();
  if (next <= current) return;
  localStorage.setItem(KEY_LATEST_MESSAGE_TIME_MS, String(Math.trunc(next)));
}

/**
 * 从 localStorage 读取原始 app config JSON 字符串。
 *
 * @param fallback - 未存储时的回退值。
 * @returns 原始 JSON 字符串。
 */
export function readAppConfigRaw(fallback: string): string {
  return localStorage.getItem(KEY_APP_CONFIG_RAW) ?? fallback;
}

/**
 * 将原始 app config JSON 字符串写入 localStorage。
 *
 * @param raw - 原始 JSON 字符串。
 */
export function writeAppConfigRaw(raw: string): void {
  localStorage.setItem(KEY_APP_CONFIG_RAW, raw);
}

/**
 * 读取指定 server 的 auth token。
 *
 * @param serverSocket - server socket（作为 key 后缀）。
 * @returns 存储的 token；缺失时返回空字符串。
 */
export function readAuthToken(serverSocket: string): string {
  const key = `${KEY_TOKEN_PREFIX}${getServerScopeKey(serverSocket)}`;
  const session = readAuthSession(serverSocket);
  if (session?.accessToken) return session.accessToken;
  return localStorage.getItem(key) ?? "";
}

/**
 * 将 auth token 写入指定 server 的本地存储。
 *
 * @param serverSocket - server socket（作为 key 后缀）。
 * @param token - 要写入的 token（空字符串表示清空）。
 */
export function writeAuthToken(serverSocket: string, token: string): void {
  const scope = getServerScopeKey(serverSocket);
  if (!scope) return;
  const key = `${KEY_TOKEN_PREFIX}${scope}`;
  localStorage.setItem(key, token);
}

/**
 * 读取指定 server 的持久化会话（access + refresh token）。
 *
 * 推荐原因：登出需要 refresh token（`POST /api/auth/revoke`）。
 *
 * @param serverSocket - server socket（作为 key 后缀）。
 * @returns Session 对象；缺失/非法时返回 `null`。
 */
export function readAuthSession(serverSocket: string): AuthSession | null {
  const key = `${KEY_SESSION_PREFIX}${getServerScopeKey(serverSocket)}`;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    const accessToken = String(obj.accessToken ?? "").trim();
    const refreshToken = String(obj.refreshToken ?? "").trim();
    const uid = typeof obj.uid === "string" ? obj.uid : undefined;
    const expiresAtMs = typeof obj.expiresAtMs === "number" ? obj.expiresAtMs : undefined;
    if (!accessToken && !refreshToken) return null;
    return { accessToken, refreshToken, uid, expiresAtMs };
  } catch {
    return null;
  }
}

/**
 * 持久化指定 server 的会话信息。
 *
 * 实现说明：
 * - 刻意将数据存入 `localStorage`（桌面端 webview scope）。
 * - 同时镜像写入旧版 `authToken` key，以保持旧调用点可读（只读兼容）。
 *
 * @param serverSocket - server socket（作为 key 后缀）。
 * @param session - 会话载荷；当为 `null` 时清空已存储会话。
 */
export function writeAuthSession(serverSocket: string, session: AuthSession | null): void {
  const socket = serverSocket.trim();
  const scope = getServerScopeKey(socket);
  const key = `${KEY_SESSION_PREFIX}${scope}`;
  if (!socket || !scope) return;

  if (!session) {
    localStorage.removeItem(key);
    writeAuthToken(socket, "");
    return;
  }

  const accessToken = String(session.accessToken ?? "").trim();
  const refreshToken = String(session.refreshToken ?? "").trim();
  const uid = typeof session.uid === "string" ? session.uid : undefined;
  const expiresAtMs = typeof session.expiresAtMs === "number" ? session.expiresAtMs : undefined;
  localStorage.setItem(key, JSON.stringify({ accessToken, refreshToken, uid, expiresAtMs }));
  writeAuthToken(socket, accessToken);
}

/**
 * 读取指定 server 会话的 refresh token。
 *
 * @param serverSocket - server socket（作为 key 后缀）。
 * @returns refresh token 字符串（缺失时为空字符串）。
 */
export function readRefreshToken(serverSocket: string): string {
  return readAuthSession(serverSocket)?.refreshToken ?? "";
}

/**
 * 读取指定 server 最后已处理的 WS `event_id`（用于 resume）。
 *
 * @param serverSocket - server socket（作为 key 后缀）。
 * @returns 最后 event id 字符串（缺失时为空字符串）。
 */
export function readLastEventId(serverSocket: string): string {
  const key = `${KEY_LAST_EVENT_ID_PREFIX}${getServerScopeKey(serverSocket)}`;
  return localStorage.getItem(key) ?? "";
}

/**
 * 持久化指定 server 最后已处理的 WS `event_id`（用于 resume）。
 *
 * @param serverSocket - server socket（作为 key 后缀）。
 * @param eventId - event id 字符串（空字符串表示清空）。
 */
export function writeLastEventId(serverSocket: string, eventId: string): void {
  const scope = getServerScopeKey(serverSocket);
  if (!scope) return;
  const key = `${KEY_LAST_EVENT_ID_PREFIX}${scope}`;
  const v = String(eventId ?? "").trim();
  if (!v) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, v);
}
