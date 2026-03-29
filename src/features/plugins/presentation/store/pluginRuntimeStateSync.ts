/**
 * @fileoverview plugins runtime state sync bus
 * @description
 * 抽离运行时状态变更通知，避免安装态 store 直接依赖 domain registry 的内部实现。
 */

import { createLogger } from "@/shared/utils/logger";
import { normalizeServerKey } from "@/shared/serverKey";

const logger = createLogger("pluginRuntimeStateSync");

export type PluginRuntimeStateSyncListener = () => Promise<void> | void;

const runtimeStateSyncListeners = new Map<string, Set<PluginRuntimeStateSyncListener>>();

export function registerPluginRuntimeStateSyncListener(
  serverSocket: string,
  listener: PluginRuntimeStateSyncListener,
): () => void {
  const key = normalizeServerKey(serverSocket);
  const listeners = runtimeStateSyncListeners.get(key) ?? new Set<PluginRuntimeStateSyncListener>();
  listeners.add(listener);
  runtimeStateSyncListeners.set(key, listeners);
  return () => {
    const current = runtimeStateSyncListeners.get(key);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) runtimeStateSyncListeners.delete(key);
  };
}

export function notifyPluginRuntimeStateChanged(serverSocket: string): void {
  const key = normalizeServerKey(serverSocket);
  const listeners = runtimeStateSyncListeners.get(key);
  if (!listeners || listeners.size === 0) return;
  for (const listener of listeners) {
    Promise.resolve(listener()).catch((error) => {
      logger.warn("Action: plugins_runtime_state_sync_listener_failed", {
        key,
        error: String(error),
      });
    });
  }
}

export function clearPluginRuntimeStateSyncListeners(serverSocket?: string): void {
  if (typeof serverSocket !== "string") {
    runtimeStateSyncListeners.clear();
    return;
  }
  runtimeStateSyncListeners.delete(normalizeServerKey(serverSocket));
}
