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

import type { RepoPluginCatalogPort } from "@/features/plugins/domain/ports/RepoPluginCatalogPort";
import type { PluginCatalogEntry } from "@/features/plugins/domain/types/pluginTypes";
import { CARRY_PIGEON_ACCEPT_V1 } from "@/shared/net/http/apiHeaders";
import { mapCatalogPluginEntry, type ApiCatalogPluginRecord } from "./pluginCatalogMappers";
import { createRepoCatalogError } from "./repoCatalogError";

type ApiCatalogResponse = {
  plugins: ApiCatalogPluginRecord[];
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
  if (!res.ok) {
    throw createRepoCatalogError("repo_catalog_http_error", `Repo catalog request failed: HTTP ${res.status}`, {
      status: res.status,
      url,
      repoBase,
    });
  }
  const raw = (await res.json()) as ApiCatalogResponse;

  const out: PluginCatalogEntry[] = [];
  for (const p of raw.plugins ?? []) {
    const entry = mapCatalogPluginEntry(p, "repo", false);
    if (entry) out.push(entry);
  }

  return out;
}

/**
 * HTTP 版本的 Repo 目录端口实现。
 */
export const httpRepoPluginCatalogPort: RepoPluginCatalogPort = {
  listCatalog: fetchRepoPluginCatalog,
};
