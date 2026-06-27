/**
 * @fileoverview settings 的 localStorage 适配器。
 * @description 使用浏览器 localStorage 持久化应用设置。
 */

import type { SettingsPort } from "../domain/ports/SettingsPort";
import { DEFAULT_APP_ACCENT, DEFAULT_APP_THEME, type AppAccent, type AppSettings, type AppTheme } from "../domain/types/SettingsTypes";
import { getStoredAccent, getStoredTheme, setAccent as applyAccent, setTheme as applyTheme } from "@/shared/utils/theme";
import { DEFAULT_APP_LOCALE, getStoredLocale } from "@/shared/utils/locale";

/**
 * `SettingsPort` 的 localStorage 实现。
 */
export const localStorageSettingsPort: SettingsPort = {
  async getSettings(): Promise<AppSettings> {
    return {
      theme: getStoredTheme() ?? DEFAULT_APP_THEME,
      accent: getStoredAccent() ?? DEFAULT_APP_ACCENT,
      locale: getStoredLocale() ?? DEFAULT_APP_LOCALE,
    };
  },

  async setTheme(theme: AppTheme): Promise<void> {
    applyTheme(theme);
  },

  async setAccent(accent: AppAccent): Promise<void> {
    applyAccent(accent);
  },
};
