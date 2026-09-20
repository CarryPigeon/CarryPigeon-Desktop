/**
 * @fileoverview HTTP 协议头工具（CarryPigeon API）。
 * @description 将跨模块共享的 Header 值集中到一处，避免散落硬编码字符串导致：
 * - 不一致（大小写/空格/版本号拼写差异）
 * - 升级遗漏（API version 变更时难以全量替换）
 */

/**
 * CarryPigeon API 的 `Accept` 头值。
 *
 * 服务端 API 文档（API.md §1.2）明确：推荐 `Accept: application/json`，
 * 当前没有启用媒体类型参数版本协商；自定义 vendor 媒体类型会被严格校验的
 * 服务端以 406 not_acceptable 拒绝，因此统一使用标准 JSON 类型。
 *
 * @param _apiVersion - 协议主版本号（保留参数以兼容既有调用链；当前不影响 Accept 值）。
 * @returns `Accept` 头字符串。
 */
export function buildCarryPigeonAcceptHeader(_apiVersion: number): string {
  return "application/json";
}

/**
 * CarryPigeon API v1 的 `Accept` 头常量。
 *
 * @constant
 */
export const CARRY_PIGEON_ACCEPT_V1 = buildCarryPigeonAcceptHeader(1);
