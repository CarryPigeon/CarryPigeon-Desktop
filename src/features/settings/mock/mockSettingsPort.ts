/**
 * @fileoverview settings 的 mock 适配器。
 * @description 提供内存态 `SettingsPort`，用于本地预览与测试隔离。
 */

import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { sleep } from "@/shared/mock/sleep";
import type { SettingsPort } from "../domain/ports/SettingsPort";
import { DEFAULT_APP_ACCENT, DEFAULT_APP_THEME, type AppAccent, type AppSettings, type AppTheme } from "../domain/types/SettingsTypes";
import { DEFAULT_APP_LOCALE, getStoredLocale } from "@/shared/utils/locale";
import { setAccent as applyAccent, setTheme as applyTheme } from "@/shared/utils/theme";

let mockTheme: AppTheme = DEFAULT_APP_THEME;
let mockAccent: AppAccent = DEFAULT_APP_ACCENT;

/**
 * `SettingsPort` 的内存实现。
 */
export const mockSettingsPort: SettingsPort = {
  async getSettings(): Promise<AppSettings> {
    await sleep(MOCK_LATENCY_MS);
    return {
      theme: mockTheme,
      accent: mockAccent,
      locale: getStoredLocale() ?? DEFAULT_APP_LOCALE,
    };
  },

  async setTheme(theme: AppTheme): Promise<void> {
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
