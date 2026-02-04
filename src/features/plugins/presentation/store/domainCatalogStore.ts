/**
 * @fileoverview domainCatalogStore.ts
 * @description Presentation store: server domain catalog (per server).
 *
 * The domain catalog is used to:
 * - Provide better “unknown domain” hints (which plugin provides the domain).
 * - Support contract discovery for plugin developers (schema pointers, constraints).
 *
 * API reference:
 * - `GET /api/domains/catalog` (`docs/api/11-HTTP端点清单（v1，标准版）.md`)
 */

import { computed, ref, type Ref } from "vue";
import { createLogger } from "@/shared/utils/logger";
import { fetchServerDomainCatalog, type DomainCatalogItem } from "@/features/plugins/data/httpDomainCatalog";
import { USE_MOCK_API } from "@/shared/config/runtime";

type DomainCatalogStore = {
  items: Ref<DomainCatalogItem[]>;
  loading: Ref<boolean>;
  error: Ref<string>;
  byDomain: Readonly<Ref<Record<string, DomainCatalogItem>>>;
  refresh(): Promise<void>;
};

const logger = createLogger("domainCatalogStore");
const stores = new Map<string, DomainCatalogStore>();

/**
 * Get (or create) a per-server domain catalog store.
 *
 * @param serverSocket - Server socket key.
 * @returns Store instance.
 */
export function useDomainCatalogStore(serverSocket: string): DomainCatalogStore {
  const key = serverSocket.trim() || "__no_server__";
  const existing = stores.get(key);
  if (existing) return existing;

  const items = ref<DomainCatalogItem[]>([]);
  const loading = ref(false);
  const error = ref("");

  /**
   * Build a lookup map for domain → catalog item.
   *
   * @returns Map object.
   */
  function computeByDomain(): Record<string, DomainCatalogItem> {
    const out: Record<string, DomainCatalogItem> = {};
    for (const it of items.value) {
      const d = String(it?.domain ?? "").trim();
      if (!d) continue;
      out[d] = it;
    }
    return out;
  }

  const byDomain = computed(computeByDomain);

  /**
   * Refresh domain catalog from server.
   *
   * @returns Promise<void>
   */
  async function refresh(): Promise<void> {
    if (USE_MOCK_API || key === "__no_server__") {
      items.value = [];
      error.value = "";
      return;
    }
    loading.value = true;
    error.value = "";
    try {
      items.value = await fetchServerDomainCatalog(key);
    } catch (e) {
      logger.warn("Fetch domain catalog failed", { key, error: String(e) });
      error.value = String(e);
      items.value = [];
    } finally {
      loading.value = false;
    }
  }

  const store: DomainCatalogStore = { items, loading, error, byDomain, refresh };
  stores.set(key, store);
  return store;
}

