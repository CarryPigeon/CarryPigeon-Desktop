/**
 * @fileoverview httpRepoPluginCatalog.ts
 * @description plugins｜数据层实现：httpRepoPluginCatalog。
 *
 * API 文档：
 * - 见 `docs/api/*` → Repo Catalog
 *
 * 说明：
 * - Repo catalog 不保证由聊天服务端托管；客户端可能直接请求第三方 host。
 * - 响应结构期望与 server catalog 兼容（至少包含 `plugins[]`）。
 */

import type { PluginCatalogEntry, PluginDomainPort, PluginPermission } from "@/features/plugins/domain/types/pluginTypes";
import { CARRY_PIGEON_ACCEPT_V1 } from "@/shared/net/http/apiHeaders";

type ApiCatalogResponse = {
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
 * 归一化 repo base URL，并拼接 `/plugins/catalog`。
 *
 * @param repoBase - Repo base URL（例如 `https://repo.example.com`）。
 * @returns 绝对 catalog URL；当输入无效时返回空字符串。
 */
function toRepoCatalogUrl(repoBase: string): string {
  const base = String(repoBase ?? "").trim().replace(/\/+$/u, "");
  if (!base) return "";
  return `${base}/plugins/catalog`;
}

/**
 * 将 domain 字符串映射为 UI 颜色 token（策略与 server catalog 一致）。
 *
 * @param domain - Domain 名称。
 * @returns Patchbay CSS 颜色变量之一。
 */
function mapDomainColorVar(domain: string): PluginDomainPort["colorVar"] {
  const d = domain.trim();
  if (d.startsWith("Core:")) return "--cp-domain-core";
  if (!d) return "--cp-domain-unknown";

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
 * @param key - Permission key。
 * @returns 权限描述对象。
 */
function mapPermission(key: string): PluginPermission {
  const k = key.trim();
  const risk: PluginPermission["risk"] = k === "network" ? "high" : "medium";
  return { key: k, label: k, risk };
}

/**
 * 拉取 repo 托管的插件目录。
 *
 * @param repoBase - Repo base URL。
 * @returns 目录条目列表（source=`repo`）。
 */
export async function fetchRepoPluginCatalog(repoBase: string): Promise<PluginCatalogEntry[]> {
  const url = toRepoCatalogUrl(repoBase);
  if (!url) return [];

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: CARRY_PIGEON_ACCEPT_V1 },
  });
  if (!res.ok) throw new Error(`Repo catalog request failed: HTTP ${res.status}`);
  const raw = (await res.json()) as ApiCatalogResponse;

  const out: PluginCatalogEntry[] = [];
  for (const p of raw.plugins ?? []) {
    const pluginId = String(p.plugin_id ?? "").trim();
    if (!pluginId) continue;

    const providesDomains: PluginDomainPort[] = [];
    for (const d of p.provides_domains ?? []) {
      const domain = String(d.domain ?? "").trim();
      const domainVersion = String(d.domain_version ?? "").trim();
      if (!domain) continue;
      providesDomains.push({ id: domain, label: domain, version: domainVersion || "1.0.0", colorVar: mapDomainColorVar(domain) });
    }

    const permissions = (p.permissions ?? []).map((x) => mapPermission(String(x)));
    const downloadUrl = String(p.download?.url ?? "").trim() || undefined;

    out.push({
      pluginId,
      name: String(p.name ?? pluginId).trim() || pluginId,
      tagline: "",
      description: "",
      source: "repo",
      downloadUrl,
      sha256: String(p.download?.sha256 ?? "").trim(),
      required: false,
      versions: [String(p.version ?? "").trim()].filter(Boolean),
      providesDomains,
      permissions,
    });
  }

  return out;
}
