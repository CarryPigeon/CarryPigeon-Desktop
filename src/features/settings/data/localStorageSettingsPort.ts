/**
 * @fileoverview settings 的 localStorage 适配器。
 * @description 使用浏览器 localStorage 持久化应用设置。
 */

import type { SettingsPort } from "../domain/ports/SettingsPort";
import { DEFAULT_APP_THEME, type AppSettings, type AppTheme } from "../domain/types/SettingsTypes";
import { getStoredTheme, setTheme as applyTheme } from "@/shared/utils/theme";

/**
 * `SettingsPort` 的 localStorage 实现。
 */
export const localStorageSettingsPort: SettingsPort = {
  async getSettings(): Promise<AppSettings> {
    return {
      theme: getStoredTheme() ?? DEFAULT_APP_THEME,
    };
  },

  async setTheme(theme: AppTheme): Promise<void> {
    applyTheme(theme);
  },
};
