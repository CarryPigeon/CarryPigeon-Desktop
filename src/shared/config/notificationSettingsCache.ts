/**
 * @fileoverview 桌面通知相关布尔配置缓存。
 * @description
 * 新消息热路径不应每次都 invoke 读配置。启动时预加载，设置变更后失效。
 */

import { invokeTauri } from "@/shared/tauri/invokeClient";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { isTauriRuntimeAvailable } from "@/shared/tauri/runtime";

type NotificationBoolKey = "global_dnd" | "desktop_notifications";

const cache: Partial<Record<NotificationBoolKey, boolean>> = {};
let preload: Promise<void> | null = null;

async function readBool(key: NotificationBoolKey, fallback: boolean): Promise<boolean> {
  if (!isTauriRuntimeAvailable()) return fallback;
  try {
    return await invokeTauri<boolean>(TAURI_COMMANDS.settingsGetConfigBool, { key });
  } catch {
    return fallback;
  }
}

/**
 * 预加载通知相关布尔配置。
 */
export function preloadNotificationSettingsCache(): Promise<void> {
  if (preload) return preload;
  if (cache.global_dnd !== undefined && cache.desktop_notifications !== undefined) {
    return Promise.resolve();
  }
  preload = Promise.all([
    readBool("global_dnd", false),
    readBool("desktop_notifications", true),
  ]).then(([dnd, desktop]) => {
    cache.global_dnd = dnd;
    cache.desktop_notifications = desktop;
    preload = null;
  });
  return preload;
}

/**
 * 设置变更后丢弃缓存并重新预加载。
 */
export function invalidateNotificationSettingsCache(): void {
  delete cache.global_dnd;
  delete cache.desktop_notifications;
  preload = null;
  void preloadNotificationSettingsCache();
}

/**
 * 读取全局免打扰（缓存未命中时回源）。
 */
export async function getCachedGlobalDndEnabled(): Promise<boolean> {
  if (cache.global_dnd === undefined) {
    await preloadNotificationSettingsCache();
  }
  return cache.global_dnd ?? false;
}

/**
 * 读取桌面通知开关（缓存未命中时回源）。
 */
export async function getCachedDesktopNotificationsEnabled(): Promise<boolean> {
  if (cache.desktop_notifications === undefined) {
    await preloadNotificationSettingsCache();
  }
  return cache.desktop_notifications ?? true;
}
