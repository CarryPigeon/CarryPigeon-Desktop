/**
 * @fileoverview pluginCatalogStore.ts
 * @description plugins｜展示层状态（store）：pluginCatalogStore。
 *
 * 该 store 用于缓存“插件目录（catalog）”，以 server socket 为作用域做单例复用。
 *
 * 对外暴露：
 * - `catalog`：用于渲染的有序目录列表
 * - `byId`：按 `pluginId` 的快速查找映射（便于 UI）
 * - `refresh()`：通过 `PluginManagerPort` 拉取目录并更新缓存
 */

import { computed, ref, type Ref } from "vue";
import { getPluginManagerPort, getRepoPluginCatalogPort } from "@/features/plugins/di/plugins.di";
import type { PluginCatalogEntry } from "@/features/plugins/domain/types/pluginTypes";
import { createLogger } from "@/shared/utils/logger";
import { enabledRepoSources } from "@/features/plugins/presentation/store/repoSourcesStore";
import { getOrCreateServerScopedStore } from "@/shared/utils/scopedStoreCache";

type CatalogStore = {
  catalog: Ref<PluginCatalogEntry[]>;
  loading: Ref<boolean>;
  error: Ref<string>;
  byId: Readonly<Ref<Record<string, PluginCatalogEntry>>>;
  refresh(): Promise<void>;
};

const logger = createLogger("pluginCatalogStore");
const stores = new Map<string, CatalogStore>();

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
        const serverCatalog = await getPluginManagerPort().listCatalog(key);
        const mergedById = new Map<string, PluginCatalogEntry>();
        for (const item of serverCatalog) mergedById.set(item.pluginId, item);

        const repoErrors: string[] = [];
        const repos = enabledRepoSources.value;
        if (repos.length > 0) {
          const settled = await Promise.allSettled(repos.map((r) => getRepoPluginCatalogPort().fetch(r.baseUrl)));
          for (let i = 0; i < settled.length; i += 1) {
            const s = settled[i];
            const repo = repos[i];
            if (s.status === "rejected") {
              repoErrors.push(`${repo.baseUrl}: ${String(s.reason)}`);
              continue;
            }
            for (const entry of s.value) {
              const existing = mergedById.get(entry.pluginId) ?? null;
              if (!existing) {
                mergedById.set(entry.pluginId, entry);
                continue;
              }
              const versions = new Set<string>();
              for (const v of existing.versions ?? []) versions.add(String(v).trim());
              for (const v of entry.versions ?? []) versions.add(String(v).trim());

              const providesDomains = new Map<string, PluginCatalogEntry["providesDomains"][number]>();
              for (const d of existing.providesDomains) providesDomains.set(d.id, d);
              for (const d of entry.providesDomains) providesDomains.set(d.id, d);

              const permissions = new Map<string, PluginCatalogEntry["permissions"][number]>();
              for (const p of existing.permissions) permissions.set(p.key, p);
              for (const p of entry.permissions) permissions.set(p.key, p);

              mergedById.set(entry.pluginId, {
                ...existing,
                required: Boolean(existing.required || entry.required),
                versions: Array.from(versions).filter(Boolean),
                providesDomains: Array.from(providesDomains.values()),
                permissions: Array.from(permissions.values()),
                // 若服务端返回了下载信息，则优先使用服务端提供的 URL/校验值。
                downloadUrl: existing.downloadUrl || entry.downloadUrl,
                sha256: existing.sha256 || entry.sha256,
              });
            }
          }
        }
        // UI 排序：required 优先，其次按名称排序。
        const merged = Array.from(mergedById.values()).sort((a, b) => {
          if (a.required !== b.required) return a.required ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        catalog.value = merged;
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
