/**
 * @fileoverview HTTP 协议头工具（CarryPigeon API）。
 * @description 将跨模块共享的 Header 值集中到一处，避免散落硬编码字符串导致：
 * - 不一致（大小写/空格/版本号拼写差异）
 * - 升级遗漏（API version 变更时难以全量替换）
 */

/**
 * 构造 CarryPigeon API 的 `Accept` 头值。
 *
 * @param apiVersion - 协议主版本号（例如 1）。
 * @returns `Accept` 头字符串。
 */
export function buildCarryPigeonAcceptHeader(apiVersion: number): string {
  return `application/vnd.carrypigeon+json; version=${apiVersion}`;
}

/**
 * CarryPigeon API v1 的 `Accept` 头常量。
 *
 * @constant
 */
export const CARRY_PIGEON_ACCEPT_V1 = buildCarryPigeonAcceptHeader(1);

