/**
 * @fileoverview 插件事件订阅能力工厂（白名单约束）。
 * @description plugins｜runtime：受事件白名单约束的 Tauri 事件订阅能力。
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { createLogger } from "@/shared/utils/logger";
import type { PluginScope } from "./pluginScope";

const logger = createLogger("plugin-event-api");

/**
 * 判断插件 scope 是否已销毁（已销毁时输出英文告警，含 pluginId）。
 * 供各 host API 方法做 dispose 后的 no-op 防御。
 */
function warnIfScopeDisposed(scope: PluginScope | undefined, pluginId: string): boolean {
  if (scope?.disposed) {
    logger.warn("Action: plugins_scope_disposed_on_event_noop", { pluginId });
    return true;
  }
  return false;
}

/**
 * 创建受白名单约束的插件事件订阅能力。
 *
 * 仅当事件名以 `allowedPrefix` 开头时才允许订阅底层 Tauri `listen`，
 * 否则直接抛错拒绝。返回一个取消订阅函数（unlisten）。
 *
 * 说明：
 * - 底层 `listen` 是异步获取 unlisten 的，这里用 `cancelled` 标记
 *   处理「先调用取消、再拿到 unlisten」的竞态；
 * - 传入 `scope` 时，订阅取消函数会同时注册到 `scope.onDispose`，
 *   scope 销毁后订阅自动失效（返回的取消函数仍保留，双重保险）；
 * - scope 已销毁后调用 `onEvent` 变为 no-op 并告警（不改变白名单门控语义）。
 *
 * @param allowedPrefix 事件白名单前缀（如 "voice_call:"）。
 * @param scope 可选的插件作用域（销毁时自动取消订阅）。
 * @param pluginId 插件标识（用于 dispose 防御告警定位）。
 * @returns 一个 (event, handler) => () => void 的订阅函数。
 */
export function createPluginEventApi(
  allowedPrefix: string,
  scope?: PluginScope,
  pluginId: string = "unknown",
): <T = unknown>(event: string, handler: (payload: T) => void) => () => void {
  return <T = unknown>(event: string, handler: (payload: T) => void): (() => void) => {
    // scope 已销毁：订阅直接 no-op，仅保留返回签名兼容
    if (warnIfScopeDisposed(scope, pluginId)) {
      return () => {};
    }
    if (!event.startsWith(allowedPrefix)) {
      throw new Error(`plugin event subscribe denied: "${event}" not under "${allowedPrefix}"`);
    }
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;
    listen<T>(event, (e) => handler(e.payload)).then((fn) => {
      unlisten = fn;
      if (cancelled) unlisten();
    });
    const off = () => {
      cancelled = true;
      unlisten?.();
    };
    if (scope) {
      // 双重保险：scope dispose 时自动取消订阅；手动取消时撤销 onDispose 注册
      const revoke = scope.onDispose(off);
      return () => {
        revoke();
        off();
      };
    }
    return off;
  };
}
