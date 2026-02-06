/**
 * @fileoverview ConfigTypes.ts
 * @description settings｜领域类型：ConfigTypes。
 */

/**
 * Application theme.
 */
export type AppTheme = "patchbay" | "legacy";

/**
 * User configuration.
 */
export type UserConfig = {
  theme: AppTheme;
};
