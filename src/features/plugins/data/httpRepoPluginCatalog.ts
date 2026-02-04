/**
 * @fileoverview httpRepoPluginCatalog.ts
 * @description Fetch a repo-hosted plugin catalog (`{repo_base}/plugins/catalog`).
 *
 * API doc reference:
 * - See `docs/api/*` → Repo Catalog
 *
 * Notes:
 * - Repo catalogs are not guaranteed to be served by the chat server; the
 *   client may talk to third-party hosts directly.
 * - The response structure is expected to be compatible with the server catalog
 *   (at least `plugins[]` items).
 */

import type { PluginCatalogEntry, PluginDomainPort, PluginPermission } from "@/features/plugins/domain/types/pluginTypes";

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
 * Normalize a repo base URL and append `/plugins/catalog`.
 *
 * @param repoBase - Repo base URL (e.g. `https://repo.example.com`).
 * @returns Absolute catalog URL or empty string.
 */
function toRepoCatalogUrl(repoBase: string): string {
  const base = String(repoBase ?? "").trim().replace(/\/+$/u, "");
  if (!base) return "";
  return `${base}/plugins/catalog`;
}

/**
 * Map a domain string into a UI color token (same strategy as server catalog).
 *
 * @param domain - Domain name.
 * @returns One of the Patchbay CSS color variables.
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
 * Map a permission key into a UI permission descriptor.
 *
 * @param key - Permission key.
 * @returns Permission descriptor.
 */
function mapPermission(key: string): PluginPermission {
  const k = key.trim();
  const risk: PluginPermission["risk"] = k === "network" ? "high" : "medium";
  return { key: k, label: k, risk };
}

/**
 * Fetch a repo-hosted plugin catalog.
 *
 * @param repoBase - Repo base URL.
 * @returns Catalog entries (source=`repo`).
 */
export async function fetchRepoPluginCatalog(repoBase: string): Promise<PluginCatalogEntry[]> {
  const url = toRepoCatalogUrl(repoBase);
  if (!url) return [];

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/vnd.carrypigeon+json; version=1" },
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
