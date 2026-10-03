/**
 * @fileoverview plugins 运行时：能力服务的 dispose 防御守卫。
 * @description
 * Cordis 会在插件 fiber 销毁时移除能力服务，但插件可能在销毁前已发起异步调用。
 * 这里提供一个轻量可变标记，让能力服务在销毁后把调用降级为 no-op（并输出英文告警），
 * 避免资源已释放后仍触达底层 Tauri 命令 / 事件订阅。
 */

import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("plugin-runtime-guard");

/** 只读防御标记：`disposed` 为 true 后能力服务应拒绝或降级调用。 */
export type RuntimeGuard = {
  readonly disposed: boolean;
};

/** 创建守卫及其销毁动作。 */
export function createRuntimeGuard(): { guard: RuntimeGuard; markDisposed(): void } {
  const state = { disposed: false };
  return {
    guard: state,
    markDisposed(): void {
      state.disposed = true;
    },
  };
}

/**
 * 判断守卫是否已销毁；已销毁时输出英文告警并返回 true。
 *
 * @param guard - 运行时守卫。
 * @param action - 触发告警的动作名（英文，用于日志定位）。
 * @param pluginId - 插件标识。
 * @returns 已销毁返回 true。
 */
export function isGuardDisposed(guard: RuntimeGuard | undefined, action: string, pluginId: string): boolean {
  if (guard?.disposed) {
    logger.warn("Action: plugins_runtime_disposed_call_noop", { action, pluginId });
    return true;
  }
  return false;
}
