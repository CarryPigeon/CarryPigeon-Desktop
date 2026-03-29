/**
 * @fileoverview pluginCatalogStore.ts
 * @description plugins｜展示层状态（store）：pluginCatalogStore。
 *
 * 该 store 用于缓存“插件目录（catalog）”，以 server socket 为作用域做单例复用。
 *
 * 对外暴露：
 * - `catalog`：用于渲染的有序目录列表
 * - `byId`：按 `pluginId` 的快速查找映射（便于 UI）
 * - `refresh()`：通过 `PluginCatalogPort` 拉取目录并更新缓存
 */

import { computed, ref, type Ref } from "vue";
import { getPluginCatalogPort, getRepoPluginCatalogPort } from "@/features/plugins/di/plugins.di";
import {
  getPluginCatalogVersionEntries,
  normalizePluginCatalogVersionEntries,
  type PluginCatalogEntry,
} from "@/features/plugins/domain/types/pluginTypes";
import { createLogger } from "@/shared/utils/logger";
import { enabledRepoSources } from "@/features/plugins/presentation/store/repoSourcesStore";
import { getOrCreateServerScopedStore } from "@/shared/utils/scopedStoreCache";
import { registerServerScopeCleanupHandler } from "@/shared/utils/serverScopeLifecycle";

type CatalogStore = {
  catalog: Ref<PluginCatalogEntry[]>;
  loading: Ref<boolean>;
  error: Ref<string>;
  byId: Readonly<Ref<Record<string, PluginCatalogEntry>>>;
  refresh(): Promise<void>;
};

const logger = createLogger("pluginCatalogStore");
const stores = new Map<string, CatalogStore>();
let runtimeStarted = false;
let stopRuntimeCleanup: (() => void) | null = null;

/**
 * 启动 plugin-catalog 运行时（幂等）。
 *
 * 说明：
 * - 显式注册 server-scope 清理回调；
 * - 避免模块加载时产生副作用。
 */
export function startPluginCatalogRuntime(): void {
  if (runtimeStarted) return;
  runtimeStarted = true;
  stopRuntimeCleanup = registerServerScopeCleanupHandler((event) => {
    if (event.type === "all") {
      stores.clear();
      return;
    }
    stores.delete(event.key);
  });
}

/**
 * 停止 plugin-catalog 运行时（best-effort）。
 */
export function stopPluginCatalogRuntime(): void {
  if (!runtimeStarted) return;
  runtimeStarted = false;
  stopRuntimeCleanup?.();
  stopRuntimeCleanup = null;
  stores.clear();
}

/**
 * 归一化目录条目：补齐 `versionEntries`，并让顶层来源信息与“最新版本”保持一致。
 *
 * @param item - 原始目录条目。
 * @returns 归一化后的目录条目。
 */
function normalizeCatalogEntry(item: PluginCatalogEntry): PluginCatalogEntry {
  const versionEntries = getPluginCatalogVersionEntries(item);
  const latest = versionEntries[0] ?? null;
  return {
    ...item,
    source: latest?.source ?? item.source,
    downloadUrl: latest?.downloadUrl ?? item.downloadUrl,
    sha256: String(latest?.sha256 ?? item.sha256 ?? "").trim(),
    versions: versionEntries.map((x) => x.version),
    versionEntries,
  };
}

/**
 * 合并同一 pluginId 的目录条目（通常是 server + repo）。
 *
 * @param existing - 已存在条目（优先保留其展示字段）。
 * @param incoming - 新进入条目。
 * @returns 合并后的条目。
 */
function mergeCatalogEntry(existing: PluginCatalogEntry, incoming: PluginCatalogEntry): PluginCatalogEntry {
  const versionEntries = normalizePluginCatalogVersionEntries([
    ...getPluginCatalogVersionEntries(existing),
    ...getPluginCatalogVersionEntries(incoming),
  ]);
  const latest = versionEntries[0] ?? null;

  const providesDomains = new Map<string, PluginCatalogEntry["providesDomains"][number]>();
  for (const d of existing.providesDomains) providesDomains.set(d.id, d);
  for (const d of incoming.providesDomains) providesDomains.set(d.id, d);

  const permissions = new Map<string, PluginCatalogEntry["permissions"][number]>();
  for (const p of existing.permissions) permissions.set(p.key, p);
  for (const p of incoming.permissions) permissions.set(p.key, p);

  return {
    ...existing,
    required: Boolean(existing.required || incoming.required),
    source: latest?.source ?? existing.source,
    versions: versionEntries.map((x) => x.version),
    versionEntries,
    providesDomains: Array.from(providesDomains.values()),
    permissions: Array.from(permissions.values()),
    downloadUrl: latest?.downloadUrl ?? existing.downloadUrl ?? incoming.downloadUrl,
    sha256: String(latest?.sha256 ?? existing.sha256 ?? incoming.sha256 ?? "").trim(),
  };
}

function sortCatalogEntries(entries: Iterable<PluginCatalogEntry>): PluginCatalogEntry[] {
  return Array.from(entries).sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

type RepoCatalogLoadResult = {
  mergedById: Map<string, PluginCatalogEntry>;
  errors: string[];
};

/**
 * 拉取所有已启用 repo 的 catalog，并按 pluginId 合并。
 *
 * 行为：
 * - 单个 repo 失败不会中断其它 repo；
 * - 每个 repo 的错误会汇总返回，由调用方决定是否展示。
 *
 * @param repos - 已启用 repo 列表。
 * @returns 合并后的条目映射与错误列表。
 */
async function loadRepoCatalogs(
  repos: readonly { baseUrl: string }[],
): Promise<RepoCatalogLoadResult> {
  const mergedById = new Map<string, PluginCatalogEntry>();
  const errors: string[] = [];
  if (repos.length <= 0) return { mergedById, errors };

  const settled = await Promise.allSettled(repos.map((repo) => getRepoPluginCatalogPort().listCatalog(repo.baseUrl)));
  for (let index = 0; index < settled.length; index += 1) {
    const result = settled[index];
    const repo = repos[index];
    if (result.status === "rejected") {
      errors.push(`${repo.baseUrl}: ${String(result.reason)}`);
      continue;
    }
    for (const entry of result.value) {
      const normalized = normalizeCatalogEntry(entry);
      const existing = mergedById.get(entry.pluginId) ?? null;
      mergedById.set(entry.pluginId, existing ? mergeCatalogEntry(existing, normalized) : normalized);
    }
  }
  return { mergedById, errors };
}

/**
 * 获取（或创建）per-server 的插件目录 store。
 *
 * 缓存规则：
 * - store 以 `serverSocket.trim()` 作为 key。
 * - 当 socket 为空时使用固定 key：`NO_SERVER_KEY`，用于预览模式下保持 UI 可用。
 *
 * @param serverSocket - 当前服务器 Socket 地址。
 * @returns 对应 server scope 的稳定 store 实例。
 */
export function usePluginCatalogStore(serverSocket: string): CatalogStore {
  return getOrCreateServerScopedStore(stores, serverSocket, ({ key }) => {
    const catalog = ref<PluginCatalogEntry[]>([]);
    const loading = ref(false);
    const error = ref("");

    /**
     * 基于当前目录列表构建 `pluginId -> entry` 的查找映射。
     *
     * @returns 查找映射对象。
     */
    function computeById(): Record<string, PluginCatalogEntry> {
      const map: Record<string, PluginCatalogEntry> = {};
      for (const item of catalog.value) map[item.pluginId] = item;
      return map;
    }

    const byId = computed(computeById);

    /**
     * 刷新目录（从后端 port 拉取）。
     *
     * 失败处理：
     * - 错误会写入 `error.value` 并记录日志；
     * - 拉取失败时将目录重置为空列表，保证 UI 状态一致且可预测。
     *
     * @returns 无返回值。
     */
    async function refresh(): Promise<void> {
      loading.value = true;
      error.value = "";
      try {
        const serverCatalog = await getPluginCatalogPort().listCatalog(key);
        const mergedById = new Map<string, PluginCatalogEntry>();
        for (const item of serverCatalog) {
          mergedById.set(item.pluginId, normalizeCatalogEntry(item));
        }

        const { mergedById: repoById, errors: repoErrors } = await loadRepoCatalogs(enabledRepoSources.value);
        for (const [pluginId, repoEntry] of repoById.entries()) {
          const existing = mergedById.get(pluginId) ?? null;
          mergedById.set(pluginId, existing ? mergeCatalogEntry(existing, repoEntry) : repoEntry);
        }

        catalog.value = sortCatalogEntries(mergedById.values());
        if (repoErrors.length > 0) {
          const msg = `Repo catalog errors:\n${repoErrors.join("\n")}`;
          logger.warn("Action: plugins_repo_catalog_errors_detected", { key, errorCount: repoErrors.length });
          logger.debug("Action: plugins_repo_catalog_error_details_logged", { key, errors: repoErrors });
          error.value = msg;
        }
      } catch (e) {
        logger.error("Action: plugins_catalog_list_failed", { key, error: String(e) });
        error.value = String(e);
        catalog.value = [];
      } finally {
        loading.value = false;
      }
    }

    const store: CatalogStore = { catalog, loading, error, byId, refresh };
    return store;
  });
}
