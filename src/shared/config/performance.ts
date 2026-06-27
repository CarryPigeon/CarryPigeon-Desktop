/**
 * @fileoverview 性能监控统一开关。
 *
 * @description
 * - release 构建默认关闭所有性能监控。
 * - dev 构建默认开启。
 * - 用户可通过 localStorage 的 cp_diagnostics_enabled 在 release 中手动开启诊断模式。
 */

const DIAGNOSTICS_STORAGE_KEY = "cp_diagnostics_enabled";

/**
 * 获取用户是否手动开启了诊断模式。
 *
 * @returns 当 localStorage 中 cp_diagnostics_enabled 为 "true" 时返回 true
 */
export function getStoredDiagnosticsEnabled(): boolean {
  try {
    return localStorage.getItem(DIAGNOSTICS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * 设置诊断模式开关。
 *
 * @param enabled - 是否开启诊断模式
 */
export function setDiagnosticsEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(DIAGNOSTICS_STORAGE_KEY);
    }
  } catch {
    // localStorage 不可用时静默忽略
  }
}

/**
 * 判断当前是否启用性能监控。
 *
 * - dev 模式：始终返回 true
 * - release 模式：仅在用户开启诊断模式时返回 true
 *
 * @returns 是否允许执行性能监控相关逻辑
 */
export function isPerformanceMonitoringEnabled(): boolean {
  return import.meta.env.DEV || getStoredDiagnosticsEnabled();
}
