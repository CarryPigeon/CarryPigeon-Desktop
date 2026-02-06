/**
 * @fileoverview ConfigPort.ts
 * @description settings｜领域端口：ConfigPort。
 *
 * 实现说明：
 * - `localStorage`：基于浏览器 localStorage 的实现
 * - `mock`：用于测试的内存实现
 */

import type { AppTheme, UserConfig } from "../types/ConfigTypes";

/**
 * 配置端口（领域层）。
 */
export interface ConfigPort {
  /**
   * 获取当前用户配置。
   *
   * @returns 用户配置。
   */
  getConfig(): Promise<UserConfig>;

  /**
   * 设置应用主题。
   *
   * @param theme - 目标主题。
   */
  setTheme(theme: AppTheme): Promise<void>;
}
