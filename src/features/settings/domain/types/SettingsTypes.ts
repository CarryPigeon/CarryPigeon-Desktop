/**
 * @fileoverview settings 领域类型。
 * @description
 * 统一定义 settings feature 对外可见的稳定值对象与基础常量。
 */

import type { AppTheme } from "@/shared/utils/theme";
export type { AppTheme } from "@/shared/utils/theme";

/**
 * settings 默认主题。
 */
export const DEFAULT_APP_THEME: AppTheme = "patchbay";

/**
 * 应用设置快照。
 */
export type AppSettings = {
  theme: AppTheme;
};
