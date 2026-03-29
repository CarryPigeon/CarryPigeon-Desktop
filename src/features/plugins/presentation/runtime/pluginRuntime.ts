/**
 * @fileoverview 插件运行时加载器（桌面端）。
 * @description plugins｜展示层实现：pluginRuntime。
 * 负责动态 import 插件前端模块并完成宿主可消费的结构规范化。
 */

import type { Component } from "vue";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import type { PluginContext, PluginRuntimeContract } from "@/features/plugins/domain/types/pluginRuntimeTypes";
import {
  normalizeComponentRecord,
  normalizeRuntimeContracts,
  normalizeRuntimeProvidesDomains,
} from "./moduleNormalizers";
import { createPluginRuntimeError } from "./pluginRuntimeError";

export { createPluginNetworkApi, createPluginStorageApi, type TauriFetchResponse } from "./hostApiFactory";
export { getRuntimeEntry, getRuntimeEntryForVersion, toAppPluginEntryUrl } from "./runtimeGateway";
export type { PluginComposerPayload, PluginContext, PluginRuntimeContract } from "@/features/plugins/domain/types/pluginRuntimeTypes";

/**
 * 宿主规范化后的插件模块结构。
 */
export type LoadedPluginModule = {
  pluginId: string;
  version: string;
  manifest: unknown;
  permissions: string[];
  providesDomains: Array<{ domain: string; domainVersion: string }>;
  renderers: Record<string, Component>;
  composers: Record<string, Component>;
  contracts: PluginRuntimeContract[];
  activate?: (ctx: PluginContext) => unknown;
  deactivate?: () => unknown;
};

/**
 * 从 `app://plugins/...` 动态 import 插件模块。
 *
 * @param entryUrl - 绝对 entry URL。
 * @returns 原始模块命名空间对象。
 */
export async function importPluginModule(entryUrl: string): Promise<Record<string, unknown>> {
  const url = String(entryUrl ?? "").trim();
  if (!url) {
    throw createPluginRuntimeError("missing_plugin_entry_url", "缺少插件 entry URL");
  }
  // cache-bust：允许在 import 失败后重新加载同一版本。
  const bust = `t=${Date.now().toString(16)}`;
  const finalUrl = url.includes("?") ? `${url}&${bust}` : `${url}?${bust}`;
  // @ts-ignore - Vite 对动态 URL import 会报错，这里显式忽略。
  return import(/* @vite-ignore */ finalUrl);
}

/**
 * 将插件模块导出规范化为宿主可消费的结构。
 *
 * @param pluginId - 插件 id。
 * @param version - 插件版本。
 * @param runtime - 运行时入口信息（来自 Rust side）。
 * @param mod - import 得到的模块命名空间。
 * @returns 规范化后的插件模块对象。
 */
export function normalizePluginModule(
  pluginId: string,
  version: string,
  runtime: PluginRuntimeEntry,
  mod: Record<string, unknown>,
): LoadedPluginModule {
  return {
    pluginId,
    version,
    manifest: mod.manifest ?? null,
    permissions: Array.isArray(runtime.permissions) ? runtime.permissions.map((x) => String(x)) : [],
    providesDomains: normalizeRuntimeProvidesDomains(runtime),
    renderers: normalizeComponentRecord(mod.renderers),
    composers: normalizeComponentRecord(mod.composers),
    contracts: normalizeRuntimeContracts(mod.contracts),
    activate: typeof mod.activate === "function" ? (mod.activate as LoadedPluginModule["activate"]) : undefined,
    deactivate: typeof mod.deactivate === "function" ? (mod.deactivate as LoadedPluginModule["deactivate"]) : undefined,
  };
}
