/**
 * @fileoverview account/current-user application contracts。
 * @description
 * 收敛当前用户展示快照的稳定应用层模型，避免类型源头落在 presentation store。
 */

/**
 * 当前用户快照的可信等级。
 */
export type CurrentUserTrustLevel = "anonymous" | "authenticated" | "authority_profile";

/**
 * 当前用户资料的最小展示快照模型。
 */
export type CurrentUser = {
  /**
   * 用户 id（Snowflake 字符串；保持为 string 以避免 JS 精度丢失）。
   */
  id: string;

  /**
   * 当前展示昵称。
   */
  username: string;

  /**
   * 当前展示邮箱。
   */
  email: string;

  /**
   * 当前展示简介。
   */
  description: string;

  /**
   * 当前快照的可信等级。
   */
  trustLevel: CurrentUserTrustLevel;
};

/**
 * 当前用户本地 profile patch。
 *
 * 说明：
 * - 仅用于 UI 保守回显；
 * - 不代表权威 profile 已完成同步。
 */
export type CurrentUserProfilePatch = {
  username?: string;
  email?: string;
  description?: string;
};
