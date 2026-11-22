/**
 * @fileoverview settings 的 mock 适配器。
 * @description 模拟设置操作的延迟，并从本地存储读取外观偏好。
 */

import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { sleep } from "@/shared/mock/sleep";
import type { SettingsPort } from "../domain/ports/SettingsPort";
import { DEFAULT_APP_ACCENT, DEFAULT_APP_THEME, type AppAccent, type AppSettings, type AppThemePreference } from "../domain/types/SettingsTypes";
import { DEFAULT_APP_LOCALE, getStoredLocale } from "@/shared/utils/locale";
import { getStoredAccent, getStoredThemePreference, setAccent as applyAccent, setTheme as applyTheme } from "@/shared/utils/theme";

let mockTheme: AppThemePreference = DEFAULT_APP_THEME;
let mockAccent: AppAccent = DEFAULT_APP_ACCENT;

/**
 * 本地存储不可用时，回退到当前会话的值。
 */
export const mockSettingsPort: SettingsPort = {
  async getSettings(): Promise<AppSettings> {
    await sleep(MOCK_LATENCY_MS);
    return {
      theme: getStoredThemePreference() ?? mockTheme,
      accent: getStoredAccent() ?? mockAccent,
      locale: getStoredLocale() ?? DEFAULT_APP_LOCALE,
    };
  },

  async setTheme(theme: AppThemePreference): Promise<void> {
    await sleep(MOCK_LATENCY_MS);
    mockTheme = theme;
    applyTheme(theme);
  },

  async setAccent(accent: AppAccent): Promise<void> {
    await sleep(MOCK_LATENCY_MS);
    mockAccent = accent;
    applyAccent(accent);
  },
};
