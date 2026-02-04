/**
 * @fileoverview pluginCatalogStore.ts
 * @description Presentation store: plugin catalog list (per server).
 *
 * This store is a per-server cache for the plugin catalog (available modules).
 * It exposes:
 * - `catalog`: ordered catalog list for rendering
 * - `byId`: quick lookup map by `pluginId` for UI helpers
 * - `refresh()`: fetch catalog via `PluginManagerPort`
 */

import { computed, ref, type Ref } from "vue";
import { getPluginManagerPort } from "@/features/plugins/di/plugins.di";
import type { PluginCatalogEntry } from "@/features/plugins/domain/types/pluginTypes";
import { createLogger } from "@/shared/utils/logger";
import { enabledRepoSources } from "@/features/plugins/presentation/store/repoSourcesStore";
import { fetchRepoPluginCatalog } from "@/features/plugins/data/httpRepoPluginCatalog";

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
 * Get (or create) a per-server plugin catalog store.
 *
 * Caching rules:
 * - Stores are keyed by `serverSocket.trim()`.
 * - An empty socket uses a dedicated `"__no_server__"` bucket so that UI can
 *   still render in preview mode without crashing.
 *
 * @param serverSocket - Current server socket.
 * @returns The stable store instance for that server.
 */
export function usePluginCatalogStore(serverSocket: string): CatalogStore {
  const key = serverSocket.trim() || "__no_server__";
  const existing = stores.get(key);
  if (existing) return existing;

  const catalog = ref<PluginCatalogEntry[]>([]);
  const loading = ref(false);
  const error = ref("");

  /**
   * Build a lookup map for the current catalog list.
   *
   * @returns Mapping of pluginId → catalog entry.
   */
  function computeById(): Record<string, PluginCatalogEntry> {
    const map: Record<string, PluginCatalogEntry> = {};
    for (const item of catalog.value) map[item.pluginId] = item;
    return map;
  }

  const byId = computed(computeById);

  /**
   * Refresh catalog from the backend port.
   *
   * Errors are captured into `error.value` and logged; the catalog is reset to
   * an empty list on failure to keep the UI consistent.
   *
   * @returns Promise<void>
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
        const settled = await Promise.allSettled(repos.map((r) => fetchRepoPluginCatalog(r.baseUrl)));
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
              // Prefer server download URL when available.
              downloadUrl: existing.downloadUrl || entry.downloadUrl,
              sha256: existing.sha256 || entry.sha256,
            });
          }
        }
      }

      // Sort for UI: required first, then by name.
      const merged = Array.from(mergedById.values()).sort((a, b) => {
        if (a.required !== b.required) return a.required ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      catalog.value = merged;
      if (repoErrors.length > 0) {
        const msg = `Repo catalog errors:\n${repoErrors.join("\n")}`;
        logger.warn(msg);
        error.value = msg;
      }
    } catch (e) {
      logger.error("List catalog failed", { key, error: String(e) });
      error.value = String(e);
      catalog.value = [];
    } finally {
      loading.value = false;
    }
  }

  const store: CatalogStore = { catalog, loading, error, byId, refresh };
  stores.set(key, store);
  return store;
}
