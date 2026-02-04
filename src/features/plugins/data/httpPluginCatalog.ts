/**
 * @fileoverview httpPluginCatalog.ts
 * @description HTTP adapter for fetching the server plugin catalog.
 *
 * API doc reference:
 * - See `docs/api/*` → `GET /api/plugins/catalog`
 *
 * Notes:
 * - This adapter only fetches catalog metadata; it does not install/enable plugins.
 * - Plugin install/enable/update is a client-local lifecycle handled by the plugin runtime.
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
 * Map a domain string into a UI color token.
 *
 * This keeps the plugin center readable even when the server doesn't provide
 * UI metadata for domain colors.
 *
 * @param domain - Domain name (e.g. `Core:Text`).
 * @returns One of the Patchbay CSS color variables.
 */
function mapDomainColorVar(domain: string): PluginDomainPort["colorVar"] {
  const d = domain.trim();
  if (d.startsWith("Core:")) return "--cp-domain-core";
  if (!d) return "--cp-domain-unknown";

  // Generic mapping for extension domains: stable but not tied to any specific vertical scenario.
  let hash = 0;
  for (let i = 0; i < d.length; i += 1) hash = (hash * 31 + d.charCodeAt(i)) >>> 0;
  const lane = hash % 3;
  if (lane === 0) return "--cp-domain-ext-a";
  if (lane === 1) return "--cp-domain-ext-b";
  return "--cp-domain-ext-c";
}

/**
 * Map a permission key into a UI permission descriptor.
 *
 * @param key - Permission key string.
 * @returns Permission descriptor.
 */
function mapPermission(key: string): PluginPermission {
  const k = key.trim();
  const risk: PluginPermission["risk"] = k === "network" ? "high" : "medium";
  return { key: k, label: k, risk };
}

/**
 * Fetch the server plugin catalog and map into `PluginCatalogEntry[]`.
 *
 * @param serverSocket - Server socket (used to derive HTTP origin).
 * @returns Catalog entries for UI rendering.
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
