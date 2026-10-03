/**
 * @fileoverview plugins 运行时能力服务：network。
 */

import { invokeTauri } from "@/shared/tauri";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { buildTauriTlsArgs } from "@/shared/net/tls/tauriTlsArgs";
import { isGuardDisposed, type RuntimeGuard } from "../guard";
import type { PluginFetchResponse, PluginNetworkService } from "../types";

/**
 * 创建"权限受控"的 network 服务（Rust 侧强制同源）。
 *
 * @param serverSocket 当前 server socket。
 * @param pluginId 插件标识（日志定位）。
 * @param guard 运行时守卫：销毁后返回 ok:false 空响应并告警。
 */
export function createNetworkService(
  serverSocket: string,
  pluginId: string,
  guard: RuntimeGuard,
): PluginNetworkService {
  return {
    async fetch(
      input: string,
      init?: { method?: string; headers?: Record<string, string>; body?: string },
    ): Promise<PluginFetchResponse> {
      if (isGuardDisposed(guard, "network.fetch", pluginId)) {
        return { ok: false, status: 0, bodyText: "", headers: {} };
      }
      const url = String(input ?? "").trim();
      const method = String(init?.method ?? "GET").trim() || "GET";
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const body = typeof init?.body === "string" ? init.body : undefined;
      return invokeTauri<PluginFetchResponse>(TAURI_COMMANDS.pluginsNetworkFetch, {
        serverSocket,
        url,
        method,
        headers,
        body,
        ...buildTauriTlsArgs(serverSocket),
      });
    },
  };
}
