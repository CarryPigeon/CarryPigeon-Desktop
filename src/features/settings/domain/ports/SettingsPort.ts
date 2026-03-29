/**
 * @fileoverview settings 领域配置端口。
 * @description
 * `SettingsPort` 定义 settings domain 对配置存储的最小要求。
 *
 * 实现说明：
 * - `data/` 提供真实持久化适配器；
 * - `mock/` 提供内存实现，供本地预览与测试隔离。
 */

import type { AppSettings, AppTheme } from "../types/SettingsTypes";

/**
 * settings 领域端口。
 */
export interface SettingsPort {
  /**
   * 读取当前应用设置快照。
   */
  getSettings(): Promise<AppSettings>;

  /**
   * 更新当前应用主题。
   */
  setTheme(theme: AppTheme): Promise<void>;
}
