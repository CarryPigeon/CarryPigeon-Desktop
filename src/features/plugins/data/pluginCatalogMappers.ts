/**
 * @fileoverview pluginCatalogMappers.ts
 * @description plugins｜数据层映射工具：catalog dto -> domain。
 */

import type { PluginCatalogEntry, PluginDomainPort, PluginPermission, PluginSource } from "@/features/plugins/domain/types/pluginTypes";

/**
 * catalog 插件原始记录（server/repo 共用子集）。
 */
export type ApiCatalogPluginRecord = {
  plugin_id: string;
  name: string;
  version: string;
  required?: boolean;
  permissions?: string[];
  provides_domains?: Array<{ domain: string; domain_version: string }>;
  download?: { url?: string; sha256?: string };
};

/**
 * 将 domain 字符串映射为 UI 颜色 token。
 *
 * @param domain - Domain 名称（例如 `Core:Text`）。
 * @returns Patchbay CSS 颜色变量之一。
 */
export function mapDomainColorVar(domain: string): PluginDomainPort["colorVar"] {
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
 * @param key - Permission key 字符串。
 * @returns 权限描述对象。
 */
export function mapPermission(key: string): PluginPermission {
  const k = key.trim();
  const risk: PluginPermission["risk"] = k === "network" ? "high" : "medium";
  return { key: k, label: k, risk };
}

/**
 * 将单条 catalog record 映射为 `PluginCatalogEntry`。
 *
 * @param plugin - 原始 catalog record。
 * @param source - 来源（server/repo）。
 * @param required - 是否 required（由调用方决定）。
 * @returns 映射后的目录条目；当 plugin_id 缺失时返回 `null`。
 */
export function mapCatalogPluginEntry(
  plugin: ApiCatalogPluginRecord,
  source: PluginSource,
  required: boolean,
): PluginCatalogEntry | null {
  const pluginId = String(plugin.plugin_id ?? "").trim();
  if (!pluginId) return null;

  const providesDomains: PluginDomainPort[] = [];
  for (const d of plugin.provides_domains ?? []) {
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

  const permissions = (plugin.permissions ?? []).map((x) => mapPermission(String(x)));
  const downloadUrl = String(plugin.download?.url ?? "").trim() || undefined;
  const sha256 = String(plugin.download?.sha256 ?? "").trim();
  const versions = [String(plugin.version ?? "").trim()].filter(Boolean);

  return {
    pluginId,
    name: String(plugin.name ?? pluginId).trim() || pluginId,
    tagline: "",
    description: "",
    source,
    downloadUrl,
    sha256,
    required,
    versions,
    versionEntries: versions.map((version) => ({
      version,
      source,
      downloadUrl,
      sha256,
    })),
    providesDomains,
    permissions,
  };
}
