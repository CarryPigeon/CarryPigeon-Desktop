/**
 * @fileoverview mock 存储 key 定义（mockKeys.ts）。
 * @description 仅用于本地预览的存储 key。
 */

/**
 * 本地 mock 持久化使用的 key 集合。
 *
 * @constant
 */
export const MOCK_KEYS = {
  pluginsStatePrefix: "carrypigeon:mock:plugins:",
  serversState: "carrypigeon:mock:servers",
} as const;
