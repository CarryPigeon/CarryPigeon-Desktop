/**
 * @fileoverview 插件 runtime 网关（Tauri 命令调用）。
 * @description plugins｜runtime gateway：仅负责 invoke 与参数组装。
 */

import { buildTauriTlsArgs } from "@/shared/net/tls/tauriTlsArgs";
import { invokeTauri } from "@/shared/tauri";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { mapPluginRuntimeEntry, type RawPluginRuntimeEntry } from "@/features/plugins/data/pluginRuntimeWire";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import { IS_STORE_MOCK, USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import { normalizeServerKey } from "@/shared/serverKey";

function getMockRuntimeEntry(serverSocket: string, pluginId: string, version?: string): PluginRuntimeEntry {
  const id = String(pluginId ?? "").trim();
  const catalog = MOCK_PLUGIN_CATALOG.find((plugin) => plugin.pluginId === id);
  if (!catalog) throw new Error(`Mock plugin runtime not found: ${id}`);
  const v = String(version ?? "").trim() || catalog.versions[0] || "0.0.0";
  if (!catalog.versions.includes(v)) throw new Error(`Mock plugin version not found: ${id}@${v}`);
  return {
    serverId: normalizeServerKey(serverSocket),
    pluginId: id,
    version: v,
    entry: "mock-runtime",
    permissions: (catalog.permissions ?? []).map((permission) => permission.key),
    providesDomains: (catalog.providesDomains ?? []).map((domain) => ({
      domain: domain.id,
      domainVersion: domain.version,
    })),
    minHostVersion: "0.0.0",
  };
}

/**
 * 获取“当前选中版本”的插件运行时入口信息。
 */
export function getRuntimeEntry(serverSocket: string, pluginId: string): Promise<PluginRuntimeEntry> {
  if (IS_STORE_MOCK || USE_MOCK_TRANSPORT) {
    return Promise.resolve(getMockRuntimeEntry(serverSocket, pluginId));
  }
  return invokeTauri<RawPluginRuntimeEntry>(TAURI_COMMANDS.pluginsGetRuntimeEntry, {
    serverSocket,
    pluginId,
    ...buildTauriTlsArgs(serverSocket),
  }).then(mapPluginRuntimeEntry);
}

/**
 * 获取“指定已安装版本”的插件运行时入口信息。
 */
export function getRuntimeEntryForVersion(serverSocket: string, pluginId: string, version: string): Promise<PluginRuntimeEntry> {
  if (IS_STORE_MOCK || USE_MOCK_TRANSPORT) {
    return Promise.resolve(getMockRuntimeEntry(serverSocket, pluginId, version));
  }
  return invokeTauri<RawPluginRuntimeEntry>(TAURI_COMMANDS.pluginsGetRuntimeEntryForVersion, {
    serverSocket,
    pluginId,
    version,
    ...buildTauriTlsArgs(serverSocket),
  }).then(mapPluginRuntimeEntry);
}

/**
 * 构造 `app://plugins/...` 的动态 import 入口 URL。
 */
export function toAppPluginEntryUrl(e: PluginRuntimeEntry): string {
  const rel = String(e.entry ?? "").trim().replace(/^\/+/u, "");
  return `app://plugins/${encodeURIComponent(e.serverId)}/${encodeURIComponent(e.pluginId)}/${encodeURIComponent(e.version)}/${rel}`;
}
