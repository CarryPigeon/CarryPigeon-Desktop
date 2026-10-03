/**
 * @fileoverview plugins 运行时能力服务：storage。
 */

import { invokeTauri } from "@/shared/tauri";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { buildTauriTlsArgs } from "@/shared/net/tls/tauriTlsArgs";
import { isGuardDisposed, type RuntimeGuard } from "../guard";
import type { PluginStorageService } from "../types";

/**
 * 创建"权限受控"的 storage 服务（Rust 侧按 server_id + plugin_id 隔离）。
 *
 * @param serverSocket 当前 server socket。
 * @param pluginId 插件标识（存储命名空间）。
 * @param guard 运行时守卫：销毁后读写降级为 no-op 并告警。
 */
export function createStorageService(
  serverSocket: string,
  pluginId: string,
  guard: RuntimeGuard,
): PluginStorageService {
  return {
    async get(key: string): Promise<unknown> {
      if (isGuardDisposed(guard, "storage.get", pluginId)) return null;
      const k = String(key ?? "").trim();
      if (!k) return null;
      return invokeTauri<unknown>(TAURI_COMMANDS.pluginsStorageGet, {
        serverSocket,
        pluginId,
        key: k,
        ...buildTauriTlsArgs(serverSocket),
      });
    },
    async set(key: string, value: unknown): Promise<void> {
      if (isGuardDisposed(guard, "storage.set", pluginId)) return;
      const k = String(key ?? "").trim();
      if (!k) return;
      await invokeTauri<void>(TAURI_COMMANDS.pluginsStorageSet, {
        serverSocket,
        pluginId,
        key: k,
        value,
        ...buildTauriTlsArgs(serverSocket),
      });
    },
  };
}
