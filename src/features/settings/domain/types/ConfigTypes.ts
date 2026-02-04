/**
 * @fileoverview ConfigTypes.ts
 * @description Domain types for settings/config feature.
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
