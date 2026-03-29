/**
 * @fileoverview httpPluginCatalog.ts
 * @description plugins｜数据层实现：httpPluginCatalog。
 *
 * API 文档：
 * - 见 `docs/api/*` → `GET /api/plugins/catalog`
 *
 * 说明：
 * - 该适配器只拉取目录元数据，不负责安装/启用插件。
 * - 插件安装/启用/更新属于客户端本地生命周期，由插件运行时负责。
 */

import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";
import type { PluginCatalogPort } from "@/features/plugins/domain/ports/PluginCatalogPort";
import type { PluginCatalogEntry } from "@/features/plugins/domain/types/pluginTypes";
import { mapCatalogPluginEntry, type ApiCatalogPluginRecord } from "./pluginCatalogMappers";

type ApiCatalogResponse = {
  required_plugins?: string[];
  plugins: ApiCatalogPluginRecord[];
};

/**
 * 拉取服务端插件目录并映射为 `PluginCatalogEntry[]`。
 *
 * @param serverSocket - 服务端 socket（用于推导 HTTP origin）。
 * @returns 用于 UI 渲染的目录条目列表。
 */
export async function fetchServerPluginCatalog(serverSocket: string): Promise<PluginCatalogEntry[]> {
  const socket = serverSocket.trim();
  if (!socket) return [];

  const client = new HttpJsonClient({ serverSocket: socket, apiVersion: 1 });
  const raw = await client.requestJson<ApiCatalogResponse>("GET", "/plugins/catalog");

  const required = new Set<string>((raw.required_plugins ?? []).map((x) => String(x).trim()).filter(Boolean));

  const out: PluginCatalogEntry[] = [];
  for (const p of raw.plugins ?? []) {
    const pluginId = String(p.plugin_id ?? "").trim();
    const entry = mapCatalogPluginEntry(p, "server", Boolean(p.required) || required.has(pluginId));
    if (entry) out.push(entry);
  }

  return out;
}

/**
 * HTTP 版本的服务端插件目录端口实现。
 */
export const httpServerPluginCatalogPort: PluginCatalogPort = {
  listCatalog: fetchServerPluginCatalog,
};
