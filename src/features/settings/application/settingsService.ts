/**
 * @fileoverview settings 应用层公共编排。
 * @description
 * 为 presentation 与 feature 公共 API 提供稳定、直觉的调用入口，
 * 隐藏 DI 与 domain use case 的组装细节。
 */

import { getSetThemeUseCase, getSettingsUseCase } from "../di/settings.di";
import type { AppSettings, AppTheme } from "../domain/types/SettingsTypes";

/**
 * 读取当前应用设置快照。
 */
export function readSettings(): Promise<AppSettings> {
  return getSettingsUseCase().execute();
}

/**
 * 更新当前应用主题。
 */
export function updateTheme(theme: AppTheme): Promise<void> {
  return getSetThemeUseCase().execute(theme);
}
