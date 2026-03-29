/**
 * @fileoverview settings 主题更新用例。
 * @description 负责将主题变更提交给 `SettingsPort`。
 */

import type { SettingsPort } from "../ports/SettingsPort";
import type { AppTheme } from "../types/SettingsTypes";

/**
 * 用例：设置应用主题。
 */
export class SetTheme {
  constructor(private readonly settingsPort: SettingsPort) {}

  /**
   * 将主题写入配置存储。
   */
  execute(theme: AppTheme): Promise<void> {
    return this.settingsPort.setTheme(theme);
  }
}
