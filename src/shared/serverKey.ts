/**
 * @fileoverview 服务端 key 归一化工具（store/cache 的 Map key）。
 * @description 将“可能为空/带空白”的 server socket 归一化为稳定 key，避免各模块散落硬编码：
 * - 空字符串/全空白 → `__no_server__`
 * - 非空 → `trim()` 后的 socket
 *
 * 典型用途：
 * - 各 feature 的 store 缓存 Map key
 * - mock/预览模式下的占位 key
 */

/**
 * 空 server socket 的统一占位 key。
 *
 * @constant
 */
export const NO_SERVER_KEY = "__no_server__";

/**
 * 将 server socket 归一化为稳定 key。
 *
 * @param serverSocket - 原始 server socket 字符串。
 * @returns 归一化后的 key（非空 socket → trim 后字符串；空 socket → `NO_SERVER_KEY`）。
 */
export function normalizeServerKey(serverSocket: string): string {
  const key = String(serverSocket ?? "").trim();
  return key || NO_SERVER_KEY;
}

/**
 * 判断给定 key 是否为“无 server”的占位 key。
 *
 * @param key - store/cache 使用的 key。
 * @returns 当 key 等于 `NO_SERVER_KEY` 时返回 `true`。
 */
export function isNoServerKey(key: string): boolean {
  return String(key ?? "").trim() === NO_SERVER_KEY;
}

