/**
 * @fileoverview settings Feature 对外公共 API。
 * @description
 * 提供跨 feature 可依赖的稳定设置能力，避免直接引用 `di/`、`domain/` 或 `presentation/` 内部路径。
 */

import {
  readSettings as readSettingsFromService,
  updateTheme as updateThemeFromService,
} from "./application/settingsService";
import type { SettingsCapabilities } from "./api-types";

let settingsCapabilities: SettingsCapabilities | null = null;

/**
 * 组装 settings 对外能力对象。
 */
export function createSettingsCapabilities(): SettingsCapabilities {
  return {
    readSettings: readSettingsFromService,
    updateTheme: updateThemeFromService,
  };
}

/**
 * 获取 settings 对外能力对象（应用级惰性单例）。
 */
export function getSettingsCapabilities(): SettingsCapabilities {
  settingsCapabilities ??= createSettingsCapabilities();
  return settingsCapabilities;
}
