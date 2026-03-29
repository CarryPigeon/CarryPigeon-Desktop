/**
 * @fileoverview settings 读取用例。
 * @description 负责从 `SettingsPort` 读取当前应用设置快照。
 */

import type { SettingsPort } from "../ports/SettingsPort";
import type { AppSettings } from "../types/SettingsTypes";

/**
 * 用例：读取当前应用设置。
 */
export class GetSettings {
  constructor(private readonly settingsPort: SettingsPort) {}

  /**
   * 读取配置存储中的当前设置。
   */
  execute(): Promise<AppSettings> {
    return this.settingsPort.getSettings();
  }
}
