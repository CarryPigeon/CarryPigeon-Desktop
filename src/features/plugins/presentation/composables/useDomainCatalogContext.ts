/**
 * @fileoverview Domain Catalog 上下文组合式函数（domain catalog store + refresh）。
 * @description plugins｜模块：useDomainCatalogContext。
 * 用于复用 domain catalog store 的解析与去重刷新逻辑。
 */

import { computed, type ComputedRef } from "vue";
import { useDomainCatalogStore } from "@/features/plugins/presentation/store";
import { dedupeAsyncByKey } from "@/shared/utils/asyncDedupe";

/**
 * domain catalog 上下文（store + 去重刷新能力）。
 */
export type DomainCatalogContext = {
  domainCatalogStore: ComputedRef<ReturnType<typeof useDomainCatalogStore>>;
  refreshDomainCatalog(): Promise<void>;
};

/**
 * 创建 domain catalog 上下文。
 *
 * @param socket - 当前 server socket（已 trim）。
 * @returns domain catalog 上下文。
 */
export function createDomainCatalogContext(socket: ComputedRef<string>): DomainCatalogContext {
  const domainCatalogStore = computed(() => useDomainCatalogStore(socket.value));

  /**
   * 刷新 domain catalog，并对同一 socket 的并发刷新做去重。
   *
   * @returns 无返回值。
   */
  async function refreshDomainCatalog(): Promise<void> {
    const s = socket.value;
    if (!s) return;
    await dedupeAsyncByKey(`domainCatalog:refresh:${s}`, () => domainCatalogStore.value.refresh());
  }

  return { domainCatalogStore, refreshDomainCatalog };
}
