/**
 * @fileoverview plugins runtime access
 * @description
 * 提供面向能力的运行时访问层，避免其他 store 或跨 feature API 直接依赖 domain registry 实现细节。
 */

import type { PluginContext } from "@/features/plugins/domain/types/pluginRuntimeTypes";
import type { DomainBinding, DomainRegistryHostBridge } from "@/features/plugins/contracts/domainRegistry";
import { useDomainRegistryStore } from "./domainRegistryStore";

export type PluginRuntimeAccess = {
  ensureLoaded(): Promise<void>;
  validateVersion(pluginId: string, version: string): Promise<void>;
  reload(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;
  getBinding(domain: string): DomainBinding | null;
  getContextForPlugin(pluginId: string): PluginContext | null;
  getContextForDomain(domain: string): PluginContext | null;
  setHostBridge(bridge: DomainRegistryHostBridge | null): void;
};

export function usePluginRuntimeAccess(serverSocket: string): PluginRuntimeAccess {
  const registry = useDomainRegistryStore(serverSocket);
  return {
    ensureLoaded() {
      return registry.ensureLoaded();
    },
    async validateVersion(pluginId: string, version: string): Promise<void> {
      await registry.tryLoadVersion(pluginId, version);
    },
    async reload(pluginId: string): Promise<void> {
      await registry.disablePluginRuntime(pluginId);
      await registry.enablePluginRuntime(pluginId);
    },
    disable(pluginId: string): Promise<void> {
      return registry.disablePluginRuntime(pluginId);
    },
    getBinding(domain: string): DomainBinding | null {
      const normalizedDomain = String(domain ?? "").trim();
      if (!normalizedDomain) return null;
      return registry.bindingByDomain[normalizedDomain] ?? null;
    },
    getContextForPlugin(pluginId: string): PluginContext | null {
      return registry.getContextForPlugin(pluginId);
    },
    getContextForDomain(domain: string): PluginContext | null {
      return registry.getContextForDomain(domain);
    },
    setHostBridge(bridge: DomainRegistryHostBridge | null): void {
      registry.setHostBridge(bridge);
    },
  };
}
