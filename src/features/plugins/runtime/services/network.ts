/**
 * @fileoverview plugins 运行时能力服务：network。
 */

import { invokeTauri } from "@/shared/tauri";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { buildTauriTlsArgs } from "@/shared/net/tls/tauriTlsArgs";
import { isGuardDisposed, type RuntimeGuard } from "../guard";
import type { PluginNetworkService } from "../types";

/**
 * 创建"权限受控"的 network 服务（Rust 侧按插件权限执行边界）。
 *
 * 边界规则（Rust 侧强制）：
 * - 默认仅允许同源（当前 server origin）请求；
 * - manifest 声明 `network:external` 权限时放行任意外部 http/https 目标；
 * - 请求头值中的 `@secret(<name>)` 引用由 Rust 侧从该插件的 keyring 命名空间
 *   解析替换（密钥明文不进入 WebView）。
 *
 * @param serverSocket 当前 server socket。
 * @param pluginId 插件标识（权限与密钥命名空间归属）。
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
      init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        timeoutMs?: number;
      },
    ): Promise<PluginFetchResponseLike> {
      if (isGuardDisposed(guard, "network.fetch", pluginId)) {
        return { ok: false, status: 0, bodyText: "", headers: {} };
      }
      const url = String(input ?? "").trim();
      const method = String(init?.method ?? "GET").trim() || "GET";
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const body = typeof init?.body === "string" ? init.body : undefined;
      const timeoutMs =
        typeof init?.timeoutMs === "number" && Number.isFinite(init.timeoutMs)
          ? Math.max(0, Math.trunc(init.timeoutMs))
          : undefined;
      return invokeTauri<PluginFetchResponseLike>(TAURI_COMMANDS.pluginsNetworkFetch, {
        serverSocket,
        pluginId,
        url,
        method,
        headers,
        body,
        timeoutMs,
        ...buildTauriTlsArgs(serverSocket),
      });
    },
  };
}

/** Rust `plugins_network_fetch` 的响应形状（与 `PluginFetchResponse` 一致，局部声明避免循环依赖）。 */
type PluginFetchResponseLike = {
  ok: boolean;
  status: number;
  bodyText: string;
  headers: Record<string, string>;
};
