/**
 * @fileoverview 插件上下文组合式函数（catalog/install/required gate）。
 * @description plugins｜模块：usePluginContext。
 * 用于在多个页面中复用插件相关 store 的解析与刷新编排：
 * - 插件目录（catalog）
 * - 安装状态（installed）
 * - 必需插件列表（required ids）
 *
 * 同时提供去重后的 refresh 方法，避免不同页面并发触发重复拉取。
 */

import { computed, type ComputedRef } from "vue";
import { usePluginCatalogStore, usePluginInstallStore } from "@/features/plugins/presentation/store";
import { dedupeAsyncByKey } from "@/shared/utils/asyncDedupe";

/**
 * 插件上下文（按 socket 解析 store + 去重刷新编排）。
 */
export type PluginContext = {
  catalogStore: ComputedRef<ReturnType<typeof usePluginCatalogStore>>;
  installStore: ComputedRef<ReturnType<typeof usePluginInstallStore>>;
  /**
   * 服务器声明的必需插件 id 列表（用于 required gate）。
   */
  requiredIds: ComputedRef<string[]>;
  refreshCatalog(): Promise<void>;
  refreshInstalled(): Promise<void>;
};

type CreatePluginContextArgs = {
  /**
   * 当前 server socket（已 trim）。
   */
  socket: ComputedRef<string>;
  /**
   * server-info 中的 requiredPlugins 声明（缺失时可回退到 catalog.required）。
   */
  requiredPluginsDeclared: ComputedRef<readonly string[] | null>;
};

/**
 * 创建插件上下文（基于 socket）。
 *
 * @param args - socket + requiredPluginsDeclared。
 * @returns 插件上下文。
 */
export function createPluginContext(args: CreatePluginContextArgs): PluginContext {
  const { socket, requiredPluginsDeclared } = args;
  const catalogStore = computed(() => usePluginCatalogStore(socket.value));
  const installStore = computed(() => usePluginInstallStore(socket.value));

  const requiredIds = computed<string[]>(() => {
    const declared = requiredPluginsDeclared.value;
    if (Array.isArray(declared) && declared.length > 0) {
      return declared.map((x) => String(x).trim()).filter(Boolean);
    }
    const out: string[] = [];
    for (const p of catalogStore.value.catalog.value) {
      if (p.source === "server" && p.required) out.push(p.pluginId);
    }
    return out;
  });

  /**
   * 刷新插件目录（catalog），并对同一 socket 的并发刷新做去重。
   *
   * @returns 无返回值。
   */
  async function refreshCatalog(): Promise<void> {
    const s = socket.value;
    if (!s) return;
    await dedupeAsyncByKey(`pluginCatalog:refresh:${s}`, () => catalogStore.value.refresh());
  }

  /**
   * 刷新已安装插件状态，并对同一 socket 的并发刷新做去重。
   *
   * @returns 无返回值。
   */
  async function refreshInstalled(): Promise<void> {
    const s = socket.value;
    if (!s) return;
    await dedupeAsyncByKey(`pluginInstall:refresh:${s}`, () => installStore.value.refreshInstalled());
  }

  return { catalogStore, installStore, requiredIds, refreshCatalog, refreshInstalled };
}
