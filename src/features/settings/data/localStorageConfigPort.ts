/**
 * @fileoverview ConfigPort 的 localStorage 实现（localStorageConfigPort.ts）。
 * @description 用 localStorage 持久化用户配置（例如主题）。
 */

import type { ConfigPort } from "../domain/ports/ConfigPort";
import type { AppTheme, UserConfig } from "../domain/types/ConfigTypes";
import { getStoredTheme, setTheme as applyTheme } from "@/shared/utils/theme";

/**
 * 配置端口（ConfigPort）的 localStorage 实现。
 *
 * @constant
 */
export const localStorageConfigPort: ConfigPort = {
  async getConfig(): Promise<UserConfig> {
    return {
      theme: getStoredTheme() ?? "patchbay",
    };
  },

  async setTheme(theme: AppTheme): Promise<void> {
    applyTheme(theme);
  },
};
