/**
 * @fileoverview domain registry context resolver
 * @description
 * 提供插件上下文构建与按 plugin/domain 解析上下文的能力，降低 registry store 的内部职责密度。
 */

import { NO_SERVER_KEY } from "@/shared/serverKey";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import type { PluginComposerPayload, PluginContext } from "@/features/plugins/domain/types/pluginRuntimeTypes";
import {
  createPluginNetworkApi,
  createPluginStorageApi,
  type LoadedPluginModule,
} from "@/features/plugins/presentation/runtime/pluginRuntime";
import { getCurrentPluginUserId } from "@/features/plugins/integration/accountSession";
import type { DomainBinding, DomainRegistryHostBridge } from "@/features/plugins/contracts/domainRegistry";
import { createPluginRuntimeError } from "@/features/plugins/presentation/runtime/pluginRuntimeError";

export type DomainRegistryContextResolverDeps = {
  serverKey: string;
  runtimeLoadingDisabled: boolean;
  runtimeById: Record<string, PluginRuntimeEntry>;
  loadedById: Record<string, LoadedPluginModule>;
  bindingByDomain: Record<string, DomainBinding>;
  getHostBridge: () => DomainRegistryHostBridge | null;
};

export function createDomainRegistryContextResolver(deps: DomainRegistryContextResolverDeps) {
  function buildPluginContext(runtime: PluginRuntimeEntry, plugin: LoadedPluginModule): PluginContext {
    const socket = deps.serverKey === NO_SERVER_KEY ? "" : deps.serverKey;
    const cid = String(deps.getHostBridge()?.getCid() ?? "").trim();
    const uid = getCurrentPluginUserId();
    const lang = navigator.language || "en-US";

    const permissions = new Set(plugin.permissions.map((item) => String(item).trim()).filter(Boolean));
    const storage = createPluginStorageApi(socket, plugin.pluginId);
    const network = permissions.has("network") ? createPluginNetworkApi(socket) : undefined;

    return {
      serverSocket: socket,
      serverId: runtime.serverId,
      pluginId: plugin.pluginId,
      pluginVersion: runtime.version,
      cid,
      uid,
      lang,
      host: {
        async sendMessage(payload: PluginComposerPayload): Promise<void> {
          const bridge = deps.getHostBridge();
          if (!bridge) {
            throw createPluginRuntimeError("missing_plugin_host_bridge", "Host bridge not set: cannot send message", {
              pluginId: plugin.pluginId,
              serverSocket: socket,
              cid,
            });
          }
          await bridge.sendMessage(payload);
        },
        storage,
        network,
      },
    };
  }

  function getContextForPlugin(pluginId: string): PluginContext | null {
    if (deps.runtimeLoadingDisabled) return null;
    const id = String(pluginId ?? "").trim();
    if (!id) return null;
    const runtime = deps.runtimeById[id] ?? null;
    const loaded = deps.loadedById[id] ?? null;
    if (!runtime || !loaded) return null;
    return buildPluginContext(runtime, loaded);
  }

  function getContextForDomain(domain: string): PluginContext | null {
    const normalizedDomain = String(domain ?? "").trim();
    if (!normalizedDomain) return null;
    const binding = deps.bindingByDomain[normalizedDomain] ?? null;
    if (!binding) return null;
    return getContextForPlugin(binding.pluginId);
  }

  return {
    buildPluginContext,
    getContextForPlugin,
    getContextForDomain,
  };
}
