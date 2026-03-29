/**
 * @fileoverview settings 依赖装配。
 * @description
 * 负责组装 settings feature 的存储端口与领域用例。
 */

import { selectByMockMode } from "@/shared/config/mockModeSelector";
import type { SettingsPort } from "../domain/ports/SettingsPort";
import { localStorageSettingsPort } from "../data/localStorageSettingsPort";
import { mockSettingsPort } from "../mock/mockSettingsPort";
import { GetSettings } from "../domain/usecases/GetSettings";
import { SetTheme } from "../domain/usecases/SetTheme";

let settingsPort: SettingsPort | null = null;

/**
 * 获取单例 `SettingsPort`。
 *
 * 说明：
 * - `off/protocol`：使用 localStorage 持久化，避免启动时出现“闪屏”（theme flash）。
 * - `store`：使用 mock 配置源，便于 UI 预览与测试隔离。
 *
 * @returns `SettingsPort` 实例。
 */
export function getSettingsPort(): SettingsPort {
  if (settingsPort) return settingsPort;
  settingsPort = selectByMockMode<SettingsPort>({
    off: () => localStorageSettingsPort,
    store: () => mockSettingsPort,
    protocol: () => localStorageSettingsPort,
  });
  return settingsPort;
}

/**
 * 获取 `GetSettings` 用例实例。
 */
export function getSettingsUseCase(): GetSettings {
  return new GetSettings(getSettingsPort());
}

/**
 * 获取 `SetTheme` 用例实例。
 */
export function getSetThemeUseCase(): SetTheme {
  return new SetTheme(getSettingsPort());
}
