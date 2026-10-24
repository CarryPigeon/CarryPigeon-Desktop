/**
 * @fileoverview plugins 运行时能力服务：secrets。
 */

import { invokeTauri } from "@/shared/tauri";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { buildTauriTlsArgs } from "@/shared/net/tls/tauriTlsArgs";
import { isGuardDisposed, type RuntimeGuard } from "../guard";
import type { PluginSecretsService } from "../types";

/**
 * 创建"权限受控"的 secrets 服务（系统 keyring，按 server + plugin 隔离）。
 *
 * 安全说明：
 * - `set` 只写不读：密钥明文仅经 IPC 进入系统凭据管理器，WebView/插件存储不落明文，
 *   也无法通过任何能力回读；
 * - `status` 只返回"是否已配置 + 安全存储是否可用"，不返回密钥内容；
 * - guard 已销毁后：`set`/`clear` 降级 no-op 并告警，`status` 返回未配置。
 *
 * @param serverSocket 当前 server socket。
 * @param pluginId 插件标识（密钥命名空间）。
 * @param guard 运行时守卫。
 */
export function createSecretsService(
  serverSocket: string,
  pluginId: string,
  guard: RuntimeGuard,
): PluginSecretsService {
  return {
    async set(name: string, value: string): Promise<void> {
      if (isGuardDisposed(guard, "secrets.set", pluginId)) return;
      const n = String(name ?? "").trim();
      if (!n) return;
      await invokeTauri<void>(TAURI_COMMANDS.pluginsSecretSet, {
        serverSocket,
        pluginId,
        name: n,
        value: String(value ?? ""),
        ...buildTauriTlsArgs(serverSocket),
      });
    },
    async status(name: string): Promise<{ configured: boolean; secureStorageAvailable: boolean }> {
      if (isGuardDisposed(guard, "secrets.status", pluginId)) {
        return { configured: false, secureStorageAvailable: false };
      }
      const n = String(name ?? "").trim();
      if (!n) return { configured: false, secureStorageAvailable: false };
      try {
        const res = await invokeTauri<{
          configured?: boolean;
          secureStorageAvailable?: boolean;
        }>(TAURI_COMMANDS.pluginsSecretStatus, {
          serverSocket,
          pluginId,
          name: n,
          ...buildTauriTlsArgs(serverSocket),
        });
        return {
          configured: Boolean(res?.configured),
          secureStorageAvailable: res?.secureStorageAvailable !== false,
        };
      } catch {
        // 查询失败（非 Tauri 运行环境 / IPC 异常）按"未配置且存储不可用"处理，
        // 避免把异常抛进插件运行时。
        return { configured: false, secureStorageAvailable: false };
      }
    },
    async clear(name: string): Promise<void> {
      if (isGuardDisposed(guard, "secrets.clear", pluginId)) return;
      const n = String(name ?? "").trim();
      if (!n) return;
      await invokeTauri<void>(TAURI_COMMANDS.pluginsSecretClear, {
        serverSocket,
        pluginId,
        name: n,
        ...buildTauriTlsArgs(serverSocket),
      });
    },
  };
}
