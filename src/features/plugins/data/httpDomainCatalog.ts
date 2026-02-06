/**
 * @fileoverview httpDomainCatalog.ts
 * @description plugins｜数据层实现：httpDomainCatalog。
 *
 * API 文档：
 * - 见 `docs/api/*` → `GET /api/domains/catalog`
 *
 * 说明：
 * - 该接口为 public，必须能在 required-gate 流程中调用（未登录也可用）。
 * - 目录主要用于“契约发现（contract discovery）”与“缺少 provider”提示 UX
 *   （例如消息 domain 未知时提示安装对应插件）。
 */

import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";
import type {
  DomainCatalogItem,
  DomainConstraints,
  DomainProvider,
} from "@/features/plugins/domain/types/domainCatalogTypes";

export type { DomainCatalogItem, DomainConstraints, DomainContractPointer, DomainProvider } from "@/features/plugins/domain/types/domainCatalogTypes";

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
 * 将 API 的 provider 对象映射为强类型 provider 描述。
 *
 * @param raw - 原始 provider 对象。
 * @returns provider 描述。
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
 * 拉取服务端 domain 目录并映射为强类型列表。
 *
 * @param serverSocket - 服务端 socket（用于推导 HTTP origin）。
 * @returns domain 目录条目列表。
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
