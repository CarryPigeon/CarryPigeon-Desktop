/**
 * @fileoverview settings Feature 对外类型。
 * @description
 * 跨 feature 若需要消费 settings 的稳定能力，应优先依赖本文件导出的类型。
 */

import type { AppSettings, AppTheme } from "./domain/types/SettingsTypes";

export type { AppSettings, AppTheme } from "./domain/types/SettingsTypes";

/**
 * settings feature 对外稳定能力契约。
 *
 * 说明：
 * - 仅描述跨 feature 可见的 settings 读写能力；
 * - 调用方应通过 capability 对象访问 settings，而不是依赖内部存储实现。
 */
export type SettingsCapabilities = {
  /**
   * 读取当前应用设置。
   *
   * @returns 当前设置快照。
   */
  readSettings(): Promise<AppSettings>;

  /**
   * 更新应用主题。
   *
   * @param theme - 目标主题值。
   * @returns 主题写入完成后 resolve。
   */
  updateTheme(theme: AppTheme): Promise<void>;
};
