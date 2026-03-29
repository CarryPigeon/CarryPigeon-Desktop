/**
 * @fileoverview plugins feature state access adapters。
 * @description
 * 由 presentation/store 提供 application 可消费的状态访问适配器。
 */

import type {
  PluginsRuntimeLifecycleAccess,
  PluginsRuntimeStateAccess,
  PluginsWorkspaceStateAccess,
} from "@/features/plugins/contracts/featureStateAccess";
import { dedupeRefreshBySocket } from "@/features/plugins/presentation/composables/refreshDedupe";
import { startDomainCatalogRuntime, stopDomainCatalogRuntime, useDomainCatalogStore } from "./domainCatalogStore";
import { startDomainRegistryRuntime, stopDomainRegistryRuntime } from "./domainRegistryStore";
import { startPluginCatalogRuntime, stopPluginCatalogRuntime, usePluginCatalogStore } from "./pluginCatalogStore";
import { startPluginInstallRuntime, stopPluginInstallRuntime, usePluginInstallStore } from "./pluginInstallStore";
import { usePluginRuntimeAccess } from "./pluginRuntimeAccess";

export function createPluginsRuntimeLifecycleAccess(): PluginsRuntimeLifecycleAccess {
  return {
    start(): void {
      startPluginCatalogRuntime();
      startPluginInstallRuntime();
      startDomainCatalogRuntime();
      startDomainRegistryRuntime();
    },
    async stop(): Promise<void> {
      await stopDomainRegistryRuntime();
      stopDomainCatalogRuntime();
      stopPluginInstallRuntime();
      stopPluginCatalogRuntime();
    },
  };
}

export function createPluginsWorkspaceStateAccess(serverSocket: string): PluginsWorkspaceStateAccess {
  const socket = String(serverSocket ?? "").trim();

  return {
    getCatalogState() {
      const catalogStore = usePluginCatalogStore(socket);
      return {
        catalog: catalogStore.catalog.value,
        catalogById: catalogStore.byId.value,
        catalogLoading: catalogStore.loading.value,
        catalogError: catalogStore.error.value,
      };
    },
    getInstallState() {
      const installStore = usePluginInstallStore(socket);
      return {
        installedById: installStore.installedById,
        progressById: installStore.progressById,
        busyPluginIds: Object.freeze(Array.from(installStore.busyIds.value)),
        missingRequiredIds: installStore.missingRequiredIds.value,
      };
    },
    refreshDomainCatalog(): Promise<void> {
      return dedupeRefreshBySocket("domainCatalog:refresh", socket, () => useDomainCatalogStore(socket).refresh());
    },
    refreshCatalog(): Promise<void> {
      return dedupeRefreshBySocket("pluginCatalog:refresh", socket, () => usePluginCatalogStore(socket).refresh());
    },
    refreshInstalled(): Promise<void> {
      return dedupeRefreshBySocket("pluginInstall:refresh", socket, () => usePluginInstallStore(socket).refreshInstalled());
    },
    recheckRequired(requiredIds: readonly string[]): void {
      usePluginInstallStore(socket).recheckRequired([...requiredIds]);
    },
    install(plugin, version) {
      return usePluginInstallStore(socket).install(plugin, version);
    },
    updateToLatest(plugin, latestVersion) {
      return usePluginInstallStore(socket).updateToLatest(plugin, latestVersion);
    },
    switchVersion(pluginId, version) {
      return usePluginInstallStore(socket).switchVersion(pluginId, version);
    },
    rollback(pluginId) {
      return usePluginInstallStore(socket).rollback(pluginId);
    },
    enable(pluginId) {
      return usePluginInstallStore(socket).enable(pluginId);
    },
    disable(pluginId) {
      return usePluginInstallStore(socket).disable(pluginId);
    },
    uninstall(pluginId) {
      return usePluginInstallStore(socket).uninstall(pluginId);
    },
    isInstalled(pluginId) {
      return usePluginInstallStore(socket).isInstalled(pluginId);
    },
    isEnabled(pluginId) {
      return usePluginInstallStore(socket).isEnabled(pluginId);
    },
    isFailed(pluginId) {
      return usePluginInstallStore(socket).isFailed(pluginId);
    },
    getDomainCatalogItem(domain) {
      const normalizedDomain = String(domain ?? "").trim();
      if (!normalizedDomain) return null;
      return useDomainCatalogStore(socket).byDomain.value[normalizedDomain] ?? null;
    },
  };
}

export function createPluginsRuntimeStateAccess(serverSocket: string): PluginsRuntimeStateAccess {
  const runtimeAccess = usePluginRuntimeAccess(serverSocket);

  return {
    ensureLoaded(): Promise<void> {
      return runtimeAccess.ensureLoaded();
    },
    getBinding(domain) {
      return runtimeAccess.getBinding(domain);
    },
    getContextForPlugin(pluginId) {
      return runtimeAccess.getContextForPlugin(pluginId);
    },
    getContextForDomain(domain) {
      return runtimeAccess.getContextForDomain(domain);
    },
    setHostBridge(bridge): void {
      runtimeAccess.setHostBridge(bridge);
    },
  };
}
