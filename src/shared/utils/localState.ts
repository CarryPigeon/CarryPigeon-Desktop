/**
 * @fileoverview 本地持久化的轻量状态（localStorage）。
 * @description 用于替代原先由 Rust/SQLite 提供的“业务游标/配置”等小数据存储。
 */

const KEY_LATEST_MESSAGE_TIME_MS = "carrypigeon:latestMessageTimeMs";
const KEY_APP_CONFIG_RAW = "carrypigeon:appConfigRaw";
const KEY_TOKEN_PREFIX = "carrypigeon:authToken:";

/**
 * safeParseNumber 方法说明。
 * @param value - 参数说明。
 * @returns 返回值说明。
 */
function safeParseNumber(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 获取本地已知的最新消息时间戳（毫秒）。
 * @returns 毫秒时间戳；无则返回 0
 */
/**
 * getLatestLocalMessageTimeMs 方法说明。
 * @returns 返回值说明。
 */
export function getLatestLocalMessageTimeMs(): number {
  return safeParseNumber(localStorage.getItem(KEY_LATEST_MESSAGE_TIME_MS)) ?? 0;
}

/**
 * 以“取最大值”的方式更新本地最新消息时间戳（毫秒）。
 * @param next - 候选时间戳（毫秒）
 */
/**
 * bumpLatestLocalMessageTimeMs 方法说明。
 * @param next - 参数说明。
 * @returns 返回值说明。
 */
export function bumpLatestLocalMessageTimeMs(next: number): void {
  if (!Number.isFinite(next) || next <= 0) return;
  const current = getLatestLocalMessageTimeMs();
  if (next <= current) return;
  localStorage.setItem(KEY_LATEST_MESSAGE_TIME_MS, String(Math.trunc(next)));
}

/**
 * 读取应用配置原始 JSON 字符串（localStorage）。
 * @param fallback - 当没有存储值时返回该值
 * @returns 原始 JSON 字符串
 */
/**
 * readAppConfigRaw 方法说明。
 * @param fallback - 参数说明。
 * @returns 返回值说明。
 */
export function readAppConfigRaw(fallback: string): string {
  return localStorage.getItem(KEY_APP_CONFIG_RAW) ?? fallback;
}

/**
 * 写入应用配置原始 JSON 字符串（localStorage）。
 * @param raw - 原始 JSON 字符串
 */
/**
 * writeAppConfigRaw 方法说明。
 * @param raw - 参数说明。
 * @returns 返回值说明。
 */
export function writeAppConfigRaw(raw: string): void {
  localStorage.setItem(KEY_APP_CONFIG_RAW, raw);
}

/**
 * readAuthToken 方法说明。
 * @param serverSocket - 参数说明。
 * @returns 返回值说明。
 */
export function readAuthToken(serverSocket: string): string {
  const key = `${KEY_TOKEN_PREFIX}${serverSocket.trim()}`;
  return localStorage.getItem(key) ?? "";
}

/**
 * writeAuthToken 方法说明。
 * @param serverSocket - 参数说明。
 * @param token - 参数说明。
 * @returns 返回值说明。
 */
export function writeAuthToken(serverSocket: string, token: string): void {
  const key = `${KEY_TOKEN_PREFIX}${serverSocket.trim()}`;
  localStorage.setItem(key, token);
}
