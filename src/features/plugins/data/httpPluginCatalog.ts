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
import type { PluginCatalogEntry, PluginDomainPort, PluginPermission } from "@/features/plugins/domain/types/pluginTypes";

type ApiCatalogResponse = {
  required_plugins?: string[];
  plugins: Array<{
    plugin_id: string;
    name: string;
    version: string;
    required?: boolean;
    permissions?: string[];
    provides_domains?: Array<{ domain: string; domain_version: string }>;
    download?: { url?: string; sha256?: string };
  }>;
};

/**
 * 将 domain 字符串映射为 UI 颜色 token。
 *
 * 用途：
 * 即使服务端不提供“domain 颜色”相关 UI 元数据，也能保持插件中心的可读性与稳定视觉区分。
 *
 * @param domain - Domain 名称（例如 `Core:Text`）。
 * @returns Patchbay CSS 颜色变量之一。
 */
function mapDomainColorVar(domain: string): PluginDomainPort["colorVar"] {
  const d = domain.trim();
  if (d.startsWith("Core:")) return "--cp-domain-core";
  if (!d) return "--cp-domain-unknown";

  // 扩展 domain 的通用映射：稳定但不绑定具体业务场景。
  let hash = 0;
  for (let i = 0; i < d.length; i += 1) hash = (hash * 31 + d.charCodeAt(i)) >>> 0;
  const lane = hash % 3;
  if (lane === 0) return "--cp-domain-ext-a";
  if (lane === 1) return "--cp-domain-ext-b";
  return "--cp-domain-ext-c";
}

/**
 * 将 permission key 映射为 UI 权限描述。
 *
 * @param key - Permission key 字符串。
 * @returns 权限描述对象。
 */
function mapPermission(key: string): PluginPermission {
  const k = key.trim();
  const risk: PluginPermission["risk"] = k === "network" ? "high" : "medium";
  return { key: k, label: k, risk };
}

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
    if (!pluginId) continue;

    const providesDomains: PluginDomainPort[] = [];
    for (const d of p.provides_domains ?? []) {
      const domain = String(d.domain ?? "").trim();
      const domainVersion = String(d.domain_version ?? "").trim();
      if (!domain) continue;
      providesDomains.push({
        id: domain,
        label: domain,
        version: domainVersion || "1.0.0",
        colorVar: mapDomainColorVar(domain),
      });
    }

    const permissions = (p.permissions ?? []).map((x) => mapPermission(String(x)));
    const downloadUrl = String(p.download?.url ?? "").trim() || undefined;

    out.push({
      pluginId,
      name: String(p.name ?? pluginId).trim() || pluginId,
      tagline: "",
      description: "",
      source: "server",
      downloadUrl,
      sha256: String(p.download?.sha256 ?? "").trim(),
      required: Boolean(p.required) || required.has(pluginId),
      versions: [String(p.version ?? "").trim()].filter(Boolean),
      providesDomains,
      permissions,
    });
  }

  return out;
}
