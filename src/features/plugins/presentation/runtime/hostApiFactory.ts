/**
 * @fileoverview 插件 Host API 工厂。
 * @description plugins｜runtime host API factory：仅负责构造受控 host 能力。
 */

import type { PluginContext, PluginComposerPayload } from "@/features/plugins/domain/types/pluginRuntimeTypes";
import { buildTauriTlsArgs } from "@/shared/net/tls/tauriTlsArgs";
import { invokeTauri } from "@/shared/tauri";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { createPluginInvokeApi } from "./pluginInvokeApi";
import { createPluginEventApi } from "./pluginEventApi";
import { createPluginUiApi, type PluginUiBridge } from "./pluginUiApi";

export type TauriFetchResponse = {
  ok: boolean;
  status: number;
  bodyText: string;
  headers: Record<string, string>;
};

/**
 * 创建“权限受控”的 storage API（Rust 侧按 server_id 隔离）。
 */
export function createPluginStorageApi(serverSocket: string, pluginId: string): PluginContext["host"]["storage"] {
  return {
    async get(key: string): Promise<unknown> {
      const k = String(key ?? "").trim();
      if (!k) return null;
      return invokeTauri<unknown>(TAURI_COMMANDS.pluginsStorageGet, { serverSocket, pluginId, key: k, ...buildTauriTlsArgs(serverSocket) });
    },
    async set(key: string, value: unknown): Promise<void> {
      const k = String(key ?? "").trim();
      if (!k) return;
      await invokeTauri<void>(TAURI_COMMANDS.pluginsStorageSet, { serverSocket, pluginId, key: k, value, ...buildTauriTlsArgs(serverSocket) });
    },
  };
}

/**
 * 创建“权限受控”的 network API（Rust 侧强制同源）。
 */
export function createPluginNetworkApi(serverSocket: string): NonNullable<PluginContext["host"]["network"]> {
  return {
    async fetch(input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<TauriFetchResponse> {
      const url = String(input ?? "").trim();
      const method = String(init?.method ?? "GET").trim() || "GET";
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const body = typeof init?.body === "string" ? init.body : undefined;
      const res = await invokeTauri<{ ok: boolean; status: number; bodyText: string; headers: Record<string, string> }>(
        TAURI_COMMANDS.pluginsNetworkFetch,
        { serverSocket, url, method, headers, body, ...buildTauriTlsArgs(serverSocket) },
      );
      return res;
    },
  };
}

/**
 * 组装受权限 / 白名单约束的完整插件 host 能力。
 *
 * 说明：
 * - `storage` 始终注入；`network` 仅当 `permissions` 包含 "network" 时注入；
 * - `invoke` / `onEvent` 分别由 "invoke" / "events" 权限门控，且命令/事件均以
 *   白名单前缀（目前固定为 "voice_call:"）约束，杜绝越权调用；
 * - `mountOverlay` / `registerToolbarAction` 由 "ui" 权限 + 宿主 UI 桥共同门控；
 * - `sendMessage` 由 "messages:send" 权限门控（默认拒绝）：以当前用户身份发言
 *   属高危能力，零权限/未申请该权限的插件不得获得。
 *
 * 注：`sendMessage` 的实际实现依赖宿主运行时桥（非纯数据），
 * 由调用方（domainRegistryContext）传入。
 */
export function createHostApi(
  serverSocket: string,
  pluginId: string,
  permissions: string[],
  uiBridge?: PluginUiBridge,
  sendMessage?: (payload: PluginComposerPayload) => Promise<void>,
): PluginContext["host"] {
  const canSendMessages = permissions.includes("messages:send");
  const host: PluginContext["host"] = {
    sendMessage: async (payload) => {
      if (!canSendMessages) {
        throw new Error(
          `[PLUGIN_PERMISSION_DENIED] plugin ${pluginId} lacks "messages:send" permission`,
        );
      }
      if (!sendMessage) {
        throw new Error(`plugin ${pluginId} host.sendMessage not provided`);
      }
      await sendMessage(payload);
    },
    storage: createPluginStorageApi(serverSocket, pluginId),
    network: permissions.includes("network") ? createPluginNetworkApi(serverSocket) : undefined,
  };
  if (permissions.includes("invoke")) {
    host.invoke = createPluginInvokeApi(serverSocket, pluginId, "voice_call:") as never;
  }
  if (permissions.includes("events")) {
    host.onEvent = createPluginEventApi("voice_call:") as never;
  }
  if (permissions.includes("ui") && uiBridge) {
    const ui = createPluginUiApi(uiBridge);
    host.mountOverlay = ui.mountOverlay as never;
    host.registerToolbarAction = ui.registerToolbarAction as never;
  }
  return host;
}
