/**
 * @fileoverview httpDomainCatalog.ts
 * @description HTTP adapter for fetching the server domain catalog (`/api/domains/catalog`).
 *
 * API doc reference:
 * - See `docs/api/*` → `GET /api/domains/catalog`
 *
 * Notes:
 * - This endpoint is public and must be callable during required-gate flows.
 * - The catalog is primarily used for contract discovery and “missing provider”
 *   UX (e.g. when a message domain is unknown).
 */

import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";

export type DomainProvider =
  | { type: "core" }
  | { type: "plugin"; pluginId: string; minPluginVersion?: string };

export type DomainContractPointer = {
  schemaUrl: string;
  sha256: string;
};

export type DomainConstraints = {
  maxPayloadBytes?: number;
  maxDepth?: number;
  [key: string]: unknown;
};

export type DomainCatalogItem = {
  domain: string;
  supportedVersions: string[];
  recommendedVersion: string;
  constraints: DomainConstraints;
  providers: DomainProvider[];
  contract?: DomainContractPointer;
};

type ApiDomainCatalogResponse = {
  items: Array<{
    domain: string;
    supported_versions?: string[];
    recommended_version?: string;
    constraints?: Record<string, unknown>;
    providers?: Array<{ type: string; plugin_id?: string; min_plugin_version?: string }>;
    contract?: { schema_url?: string; sha256?: string };
  }>;
};

/**
 * Map API provider payload into a typed provider descriptor.
 *
 * @param raw - Raw provider object.
 * @returns Provider descriptor.
 */
function mapProvider(raw: { type: string; plugin_id?: string; min_plugin_version?: string }): DomainProvider {
  const t = String(raw.type ?? "").trim();
  if (t === "plugin") {
    return {
      type: "plugin",
      pluginId: String(raw.plugin_id ?? "").trim(),
      minPluginVersion: String(raw.min_plugin_version ?? "").trim() || undefined,
    };
  }
  return { type: "core" };
}

/**
 * Fetch the server domain catalog and map into a typed list.
 *
 * @param serverSocket - Server socket (used to derive HTTP origin).
 * @returns Domain catalog items.
 */
export async function fetchServerDomainCatalog(serverSocket: string): Promise<DomainCatalogItem[]> {
  const socket = serverSocket.trim();
  if (!socket) return [];

  const client = new HttpJsonClient({ serverSocket: socket, apiVersion: 1 });
  const raw = await client.requestJson<ApiDomainCatalogResponse>("GET", "/domains/catalog");

  const out: DomainCatalogItem[] = [];
  for (const item of raw.items ?? []) {
    const domain = String(item.domain ?? "").trim();
    if (!domain) continue;

    const supportedVersions = (item.supported_versions ?? []).map((x) => String(x).trim()).filter(Boolean);
    const recommendedVersion = String(item.recommended_version ?? "").trim() || (supportedVersions[0] ?? "");

    const constraintsRaw = item.constraints ?? {};
    const constraints: DomainConstraints = {
      maxPayloadBytes:
        typeof constraintsRaw.max_payload_bytes === "number" ? (constraintsRaw.max_payload_bytes as number) : undefined,
      maxDepth: typeof constraintsRaw.max_depth === "number" ? (constraintsRaw.max_depth as number) : undefined,
    };

    const providers = (item.providers ?? []).map(mapProvider);
    const contract = item.contract?.schema_url
      ? {
          schemaUrl: String(item.contract.schema_url ?? "").trim(),
          sha256: String(item.contract.sha256 ?? "").trim(),
        }
      : undefined;

    out.push({
      domain,
      supportedVersions,
      recommendedVersion,
      constraints,
      providers,
      contract,
    });
  }

  return out;
}
