/**
 * @fileoverview domain registry module loader helpers
 * @description
 * 抽离运行时加载开关、noop 模块与模块加载逻辑，减少 registry store 内部噪音。
 */

import { IS_STORE_MOCK, USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import {
  importPluginModule,
  normalizePluginModule,
  toAppPluginEntryUrl,
  type LoadedPluginModule,
} from "@/features/plugins/presentation/runtime/pluginRuntime";

export function isPluginRuntimeLoadingDisabled(): boolean {
  return IS_STORE_MOCK || USE_MOCK_TRANSPORT;
}

export function createNoopLoadedPluginModule(pluginId: string, version: string): LoadedPluginModule {
  return {
    pluginId: String(pluginId ?? "").trim(),
    version: String(version ?? "").trim() || "0.0.0",
    manifest: null,
    permissions: [],
    providesDomains: [],
    renderers: {},
    composers: {},
    contracts: [],
  };
}

export async function loadPluginRuntimeModule(runtime: PluginRuntimeEntry): Promise<LoadedPluginModule> {
  const entryUrl = toAppPluginEntryUrl(runtime);
  const moduleNamespace = await importPluginModule(entryUrl);
  return normalizePluginModule(runtime.pluginId, runtime.version, runtime, moduleNamespace);
}
