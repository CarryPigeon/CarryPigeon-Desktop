/**
 * @fileoverview 插件运行时加载器（桌面端）。
 * @description plugins｜展示层实现：pluginRuntime。
 * 负责在桌面端（Tauri）环境中加载插件前端运行时，并将“受控 Host API”注入给插件使用。
 *
 * 职责范围：
 * - 通过 Tauri commands 获取插件运行时入口信息（server_id/version/entry/permissions/domains）。
 * - 从 `app://plugins/...` 动态 import 插件 ESM 入口。
 * - 规范化插件导出（renderers/composers/contracts），供宿主使用。
 *
 * 安全说明：
 * - 本运行时不是强沙箱；主要依赖“宿主只注入受控 API（如 `host.network.fetch`）”与插件契约约束。
 */

import type { Component } from "vue";
import { invokeTauri } from "@/shared/tauri";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { buildTauriTlsArgs } from "@/shared/net/tls/tauriTlsArgs";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import type { PluginContext } from "@/features/plugins/domain/types/pluginRuntimeTypes";

export type { PluginComposerPayload, PluginContext } from "@/features/plugins/domain/types/pluginRuntimeTypes";

/**
 * 宿主规范化后的插件模块结构。
 *
 * 说明：
 * - 插件模块的原始导出可能不稳定，宿主会在 `normalizePluginModule` 中做容错与归一化；
 * - `renderers/composers` 以 domain 为 key，供聊天 UI 渲染消息与挂载编辑器；
 * - `activate/deactivate` 为可选生命周期钩子。
 */
export type LoadedPluginModule = {
  pluginId: string;
  version: string;
  manifest: unknown;
  permissions: string[];
  providesDomains: Array<{ domain: string; domainVersion: string }>;
  renderers: Record<string, Component>;
  composers: Record<string, Component>;
  contracts: Array<{ domain: string; domain_version: string; payload_schema?: unknown; constraints?: unknown }>;
  activate?: (ctx: PluginContext) => unknown;
  deactivate?: () => unknown;
};

type TauriFetchResponse = {
  ok: boolean;
  status: number;
  bodyText: string;
  headers: Record<string, string>;
};

/**
 * 获取“当前选中版本”的插件运行时入口信息。
 *
 * @param serverSocket - 当前 server socket。
 * @param pluginId - 插件 id。
 * @returns 运行时入口信息（server_id/version/entry/permissions/domains）。
 */
export function getRuntimeEntry(serverSocket: string, pluginId: string): Promise<PluginRuntimeEntry> {
  return invokeTauri<PluginRuntimeEntry>(TAURI_COMMANDS.pluginsGetRuntimeEntry, {
    serverSocket,
    pluginId,
    ...buildTauriTlsArgs(serverSocket),
  });
}

/**
 * 获取“指定已安装版本”的插件运行时入口信息（不会切换 current 版本）。
 *
 * @param serverSocket - 当前 server socket。
 * @param pluginId - 插件 id。
 * @param version - 要加载的已安装版本。
 * @returns 运行时入口信息。
 */
export function getRuntimeEntryForVersion(serverSocket: string, pluginId: string, version: string): Promise<PluginRuntimeEntry> {
  return invokeTauri<PluginRuntimeEntry>(TAURI_COMMANDS.pluginsGetRuntimeEntryForVersion, {
    serverSocket,
    pluginId,
    version,
    ...buildTauriTlsArgs(serverSocket),
  });
}

/**
 * 构造 `app://plugins/...` 的动态 import 入口 URL。
 *
 * @param e - 运行时入口信息。
 * @returns 绝对 entry URL。
 */
export function toAppPluginEntryUrl(e: PluginRuntimeEntry): string {
  const rel = String(e.entry ?? "").trim().replace(/^\/+/u, "");
  return `app://plugins/${encodeURIComponent(e.serverId)}/${encodeURIComponent(e.pluginId)}/${encodeURIComponent(e.version)}/${rel}`;
}

/**
 * 创建“权限受控”的 storage API（Rust 侧按 server_id 隔离）。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @param pluginId - 插件 id。
 * @returns storage API。
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
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns network API。
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
 * 从 `app://plugins/...` 动态 import 插件模块。
 *
 * @param entryUrl - 绝对 entry URL。
 * @returns 原始模块命名空间对象。
 */
export async function importPluginModule(entryUrl: string): Promise<Record<string, unknown>> {
  const url = String(entryUrl ?? "").trim();
  if (!url) throw new Error("缺少插件 entry URL");
  // cache-bust：允许在 import 失败后重新加载同一版本。
  const bust = `t=${Date.now().toString(16)}`;
  const finalUrl = url.includes("?") ? `${url}&${bust}` : `${url}?${bust}`;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Vite 对动态 URL import 会报错，这里显式忽略。
  return import(/* @vite-ignore */ finalUrl);
}

/**
 * 将插件模块导出规范化为宿主可消费的结构。
 *
 * @param pluginId - 插件 id。
 * @param version - 插件版本。
 * @param runtime - 运行时入口信息（来自 Rust side）。
 * @param mod - import 得到的模块命名空间。
 * @returns 规范化后的插件模块对象。
 */
export function normalizePluginModule(
  pluginId: string,
  version: string,
  runtime: PluginRuntimeEntry,
  mod: Record<string, unknown>,
): LoadedPluginModule {
  const renderers = (mod.renderers ?? {}) as Record<string, Component>;
  const composers = (mod.composers ?? {}) as Record<string, Component>;
  const contracts = Array.isArray(mod.contracts) ? (mod.contracts as LoadedPluginModule["contracts"]) : [];

  return {
    pluginId,
    version,
    manifest: mod.manifest ?? null,
    permissions: Array.isArray(runtime.permissions) ? runtime.permissions.map((x) => String(x)) : [],
    providesDomains: Array.isArray(runtime.providesDomains)
      ? runtime.providesDomains.map((d) => {
          const raw = d as unknown as Record<string, unknown>;
          return {
            domain: String(raw.domain ?? "").trim(),
            domainVersion: String(raw.domainVersion ?? raw.domain_version ?? "").trim() || "1.0.0",
          };
        })
      : [],
    renderers: typeof renderers === "object" && renderers ? renderers : {},
    composers: typeof composers === "object" && composers ? composers : {},
    contracts,
    activate: typeof mod.activate === "function" ? (mod.activate as LoadedPluginModule["activate"]) : undefined,
    deactivate: typeof mod.deactivate === "function" ? (mod.deactivate as LoadedPluginModule["deactivate"]) : undefined,
  };
}
