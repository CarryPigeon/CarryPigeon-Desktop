/**
 * @fileoverview 插件事件订阅能力工厂（白名单约束）。
 * @description plugins｜runtime：受事件白名单约束的 Tauri 事件订阅能力。
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * 创建受白名单约束的插件事件订阅能力。
 *
 * 仅当事件名以 `allowedPrefix` 开头时才允许订阅底层 Tauri `listen`，
 * 否则直接抛错拒绝。返回一个取消订阅函数（unlisten）。
 *
 * 说明：底层 `listen` 是异步获取 unlisten 的，这里用 `cancelled` 标记
 * 处理「先调用取消、再拿到 unlisten」的竞态。
 *
 * @param allowedPrefix 事件白名单前缀（如 "voice_call:"）。
 * @returns 一个 (event, handler) => () => void 的订阅函数。
 */
export function createPluginEventApi(
  allowedPrefix: string,
): <T = unknown>(event: string, handler: (payload: T) => void) => () => void {
  return <T = unknown>(event: string, handler: (payload: T) => void): (() => void) => {
    if (!event.startsWith(allowedPrefix)) {
      throw new Error(`plugin event subscribe denied: "${event}" not under "${allowedPrefix}"`);
    }
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;
    listen<T>(event, (e) => handler(e.payload)).then((fn) => {
      unlisten = fn;
      if (cancelled) unlisten();
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  };
}
