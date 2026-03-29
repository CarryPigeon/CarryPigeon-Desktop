/**
 * @fileoverview account/auth-flow required gate application facade。
 * @description
 * 收敛 required-setup 缺口状态的读取与写入，避免子域 API 直接依赖展示层 store。
 */

import {
  missingRequiredPlugins,
  setMissingRequiredPlugins as setMissingRequiredPluginsInternal,
} from "../presentation/store/requiredGate";

/**
 * 读取当前 required plugin 缺口快照。
 */
export function getMissingRequiredPluginsSnapshot(): readonly string[] {
  return missingRequiredPlugins.value;
}

/**
 * 写入 required plugin 缺口列表。
 */
export function updateMissingRequiredPlugins(ids: string[]): void {
  setMissingRequiredPluginsInternal(ids);
}

/**
 * 清空 required plugin 缺口列表。
 */
export function clearMissingRequiredPlugins(): void {
  setMissingRequiredPluginsInternal([]);
}
