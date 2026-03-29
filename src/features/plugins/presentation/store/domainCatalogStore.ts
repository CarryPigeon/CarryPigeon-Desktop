/**
 * @fileoverview domainCatalogStore.ts
 * @description plugins｜展示层状态（store）：domainCatalogStore。
 *
 * domain catalog 用于：
 * - “未知 domain” 的提示增强（哪个插件提供了该 domain）。
 * - 插件开发者的契约发现（schema 指针、约束等）。
 *
 * API 参考：
 * - `GET /api/domains/catalog` (`docs/api/11-HTTP端点清单（v1，标准版）.md`)
 */

import { computed, ref, type Ref } from "vue";
import { createLogger } from "@/shared/utils/logger";
import type { DomainCatalogItem } from "@/features/plugins/domain/types/domainCatalogTypes";
import { IS_STORE_MOCK } from "@/shared/config/runtime";
import { NO_SERVER_KEY } from "@/shared/serverKey";
import { getOrCreateServerScopedStore } from "@/shared/utils/scopedStoreCache";
import { getDomainCatalogPort } from "@/features/plugins/di/plugins.di";
import { registerServerScopeCleanupHandler } from "@/shared/utils/serverScopeLifecycle";

type DomainCatalogStore = {
  items: Ref<DomainCatalogItem[]>;
  loading: Ref<boolean>;
  error: Ref<string>;
  byDomain: Readonly<Ref<Record<string, DomainCatalogItem>>>;
  refresh(): Promise<void>;
};

const logger = createLogger("domainCatalogStore");
const stores = new Map<string, DomainCatalogStore>();
let runtimeStarted = false;
let stopRuntimeCleanup: (() => void) | null = null;

/**
 * 启动 domain-catalog 运行时（幂等）。
 *
 * 说明：
 * - 显式注册 server-scope 清理回调；
 * - 避免模块加载时产生副作用。
 */
export function startDomainCatalogRuntime(): void {
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
 * 停止 domain-catalog 运行时（best-effort）。
 */
export function stopDomainCatalogRuntime(): void {
  if (!runtimeStarted) return;
  runtimeStarted = false;
  stopRuntimeCleanup?.();
  stopRuntimeCleanup = null;
  stores.clear();
}

/**
 * 获取（或创建）per-server 的 domain catalog store。
 *
 * @param serverSocket - 服务器 Socket 地址（作为 store key）。
 * @returns store 实例。
 */
export function useDomainCatalogStore(serverSocket: string): DomainCatalogStore {
  return getOrCreateServerScopedStore(stores, serverSocket, ({ key }) => {
    const items = ref<DomainCatalogItem[]>([]);
    const loading = ref(false);
    const error = ref("");

    /**
     * 构建 `domain -> item` 的查找映射。
     *
     * @returns 查找映射对象。
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
     * 刷新 domain catalog（从服务端拉取）。
     *
     * @returns 无返回值。
     */
    async function refresh(): Promise<void> {
      if (IS_STORE_MOCK || key === NO_SERVER_KEY) {
        items.value = [];
        error.value = "";
        return;
      }
      loading.value = true;
      error.value = "";
      try {
        items.value = await getDomainCatalogPort().listCatalog(key);
      } catch (e) {
        logger.warn("Action: plugins_domain_catalog_fetch_failed", { key, error: String(e) });
        error.value = String(e);
        items.value = [];
      } finally {
        loading.value = false;
      }
    }

    const store: DomainCatalogStore = { items, loading, error, byDomain, refresh };
    return store;
  });
}
