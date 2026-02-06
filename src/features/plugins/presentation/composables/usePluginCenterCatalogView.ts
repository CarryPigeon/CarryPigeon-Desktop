/**
 * @fileoverview 插件中心目录视图组合式函数（过滤/搜索/更新判断）。
 * @description plugins｜模块：usePluginCenterCatalogView。
 *
 * 职责：
 * - 维护“插件目录列表”的视图计算（筛选/搜索/状态过滤）。
 * - 提供“是否存在更新”的判断函数，供 UI 标记与过滤使用。
 *
 * 说明：
 * - 该模块只做同步计算，不发起网络请求。
 * - 依赖由页面注入，便于复用与测试。
 */

import { computed, type Ref } from "vue";
import type { PluginCatalogEntry } from "@/features/plugins/domain/types/pluginTypes";

/**
 * 插件中心“状态筛选”枚举。
 */
export type PluginCenterFilterKind = "all" | "installed" | "enabled" | "failed" | "updates" | "required";

/**
 * 插件中心“来源筛选”枚举。
 */
export type PluginCenterSourceKind = "all" | "server" | "repo";

type RefLike<T> = { value: T };
type ComputedLike<T> = { value: T };

type CatalogStoreLike = {
  catalog: RefLike<PluginCatalogEntry[]>;
  byId: RefLike<Record<string, PluginCatalogEntry>>;
};

type InstallStoreLike = {
  installedById: Record<
    string,
    | {
        currentVersion?: string | null;
        enabled?: boolean;
        status?: string;
      }
    | null
    | undefined
  >;
};

/**
 * usePluginCenterCatalogView 的入参依赖集合。
 *
 * 说明：
 * - 该组合式函数只做“同步视图计算”，不直接发请求；
 * - store 由页面注入，便于复用与测试。
 */
export type UsePluginCenterCatalogViewArgs = {
  /**
   * 当前“状态筛选”。
   */
  filter: Ref<PluginCenterFilterKind>;
  /**
   * 当前“来源筛选”。
   */
  source: Ref<PluginCenterSourceKind>;
  /**
   * 搜索关键字（原始输入）。
   */
  q: Ref<string>;
  /**
   * 插件目录 store（基于 socket 计算得来）。
   */
  catalogStore: ComputedLike<CatalogStoreLike>;
  /**
   * 安装状态 store（基于 socket 计算得来）。
   */
  installStore: ComputedLike<InstallStoreLike>;
};

/**
 * 构建插件中心“目录视图”能力。
 *
 * @param args - 依赖参数。
 * @returns `{ byId, filtered, hasUpdate }`。
 */
export function usePluginCenterCatalogView(args: UsePluginCenterCatalogViewArgs) {
  /**
   * 以 `pluginId` 为 key 暴露目录映射，供 UI 做 O(1) 查询。
   */
  const byId = computed(() => args.catalogStore.value.byId.value);

  /**
   * 判断某已安装插件是否存在更新（当前版本与目录最新版本不同）。
   *
   * @param pluginId - 插件 id。
   * @returns 存在更新则为 `true`。
   */
  function hasUpdate(pluginId: string): boolean {
    const plugin = byId.value[pluginId];
    const installed = args.installStore.value.installedById[pluginId];
    const latest = plugin?.versions?.[0] ?? "";
    const current = installed?.currentVersion ?? "";
    return Boolean(latest && current && latest !== current);
  }

  /**
   * 判断插件是否命中“来源”筛选条件。
   *
   * @param p - 目录条目。
   * @returns 命中则为 `true`。
   */
  function matchesSource(p: PluginCatalogEntry): boolean {
    return args.source.value === "all" ? true : p.source === args.source.value;
  }

  /**
   * 判断插件是否命中搜索关键字。
   *
   * @param p - 目录条目。
   * @param needle - 小写化后的搜索关键字。
   * @returns 命中则为 `true`。
   */
  function matchesQuery(p: PluginCatalogEntry, needle: string): boolean {
    if (!needle) return true;

    if (p.name.toLowerCase().includes(needle)) return true;
    if (p.pluginId.toLowerCase().includes(needle)) return true;

    for (const d of p.providesDomains) {
      if (d.id.toLowerCase().includes(needle)) return true;
      if (d.label.toLowerCase().includes(needle)) return true;
    }

    return false;
  }

  /**
   * 判断插件是否命中“状态”筛选条件。
   *
   * @param p - 目录条目。
   * @returns 命中则为 `true`。
   */
  function matchesFilter(p: PluginCatalogEntry): boolean {
    const installed = args.installStore.value.installedById[p.pluginId] ?? null;

    if (args.filter.value === "all") return true;
    if (args.filter.value === "installed") return Boolean(installed?.currentVersion);
    if (args.filter.value === "enabled") return Boolean(installed?.enabled && installed.status === "ok");
    if (args.filter.value === "failed") return Boolean(installed?.status === "failed");
    if (args.filter.value === "updates") return hasUpdate(p.pluginId);
    if (args.filter.value === "required") return Boolean(p.required);
    return true;
  }

  /**
   * 计算网格中展示的插件列表。
   */
  const filtered = computed<PluginCatalogEntry[]>(() => {
    const needle = args.q.value.trim().toLowerCase();
    const items = args.catalogStore.value.catalog.value;
    const out: PluginCatalogEntry[] = [];
    for (const p of items) {
      if (!matchesSource(p)) continue;
      if (!matchesQuery(p, needle)) continue;
      if (!matchesFilter(p)) continue;
      out.push(p);
    }
    return out;
  });

  return { byId, filtered, hasUpdate };
}
