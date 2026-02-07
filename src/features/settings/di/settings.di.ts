/**
 * @fileoverview settings.di.ts
 * @description settings｜依赖组装（DI）：settings.di。
 */

import { selectByMockMode } from "@/shared/config/mockModeSelector";
import type { ConfigPort } from "../domain/ports/ConfigPort";
import { localStorageConfigPort } from "../data/localStorageConfigPort";
import { mockConfigPort } from "../mock/mockConfigPort";
import { GetConfig } from "../domain/usecases/GetConfig";
import { SetTheme } from "../domain/usecases/SetTheme";

let configPort: ConfigPort | null = null;

// ============================================================================
// Ports
// ============================================================================

/**
 * 获取单例 `ConfigPort`。
 *
 * 说明：
 * - 主题（theme）强依赖持久化：即便在 mock 模式也倾向使用 localStorage，避免启动时出现“闪屏”（theme flash）。
 * - 如需在测试中替换为 mock，可在此处按需调整选择规则。
 *
 * @returns `ConfigPort` 实例。
 */
export function getConfigPort(): ConfigPort {
  if (configPort) return configPort;
  // 协议层 mock 也保持主题持久化稳定（localStorage）。
  configPort = selectByMockMode<ConfigPort>({
    off: () => localStorageConfigPort,
    store: () => mockConfigPort,
    protocol: () => localStorageConfigPort,
  });
  return configPort;
}

// ============================================================================
// 用例
// ============================================================================

/**
 * 获取 `GetConfig` 用例实例。
 *
 * @returns `GetConfig` 实例。
 */
export function getGetConfigUsecase(): GetConfig {
  return new GetConfig(getConfigPort());
}

/**
 * 获取 `SetTheme` 用例实例。
 *
 * @returns `SetTheme` 实例。
 */
export function getSetThemeUsecase(): SetTheme {
  return new SetTheme(getConfigPort());
}
