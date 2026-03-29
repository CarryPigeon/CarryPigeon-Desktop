/**
 * @fileoverview plugins runtime application facade。
 * @description
 * 收敛运行时加载、host bridge 与 domain 查询能力，避免根 capability 入口直接依赖展示层 store。
 */

import type { DomainBinding, DomainRegistryHostBridge } from "../contracts/domainRegistry";
import type { PluginContext as RuntimePluginContext } from "../domain/types/pluginRuntimeTypes";
import { createPluginsRuntimeStateAccess, createPluginsWorkspaceStateAccess } from "../di/plugins.di";

export type AvailablePluginMessageDomain = {
  id: string;
  label: string;
  colorVar:
    | "--cp-domain-core"
    | "--cp-domain-ext-a"
    | "--cp-domain-ext-b"
    | "--cp-domain-ext-c"
    | "--cp-domain-unknown";
  pluginIdHint?: string;
  version?: string;
};

export type PluginRuntimeCapabilities = {
  getBinding(domain: string): DomainBinding | null;
  getContextForPlugin(pluginId: string): RuntimePluginContext | null;
  getContextForDomain(domain: string): RuntimePluginContext | null;
};

export async function ensurePluginRuntimeLoaded(serverSocket: string): Promise<void> {
  const socket = String(serverSocket ?? "").trim();
  if (!socket) return;
  await createPluginsRuntimeStateAccess(socket).ensureLoaded();
}

export function getPluginRuntimeCapabilities(serverSocket: string): PluginRuntimeCapabilities {
  const runtime = createPluginsRuntimeStateAccess(serverSocket);
  return {
    getBinding(domain) {
      return runtime.getBinding(domain);
    },
    getContextForPlugin(pluginId) {
      return runtime.getContextForPlugin(pluginId);
    },
    getContextForDomain(domain) {
      return runtime.getContextForDomain(domain);
    },
  };
}

export function attachPluginHostBridge(serverSocket: string, bridge: DomainRegistryHostBridge): void {
  createPluginsRuntimeStateAccess(serverSocket).setHostBridge(bridge);
}

export function detachPluginHostBridge(serverSocket: string): void {
  createPluginsRuntimeStateAccess(serverSocket).setHostBridge(null);
}

export function getAvailableMessageDomains(serverSocket: string): AvailablePluginMessageDomain[] {
  const socket = String(serverSocket ?? "").trim();
  const workspace = createPluginsWorkspaceStateAccess(socket);
  const catalog = workspace.getCatalogState().catalog;
  const install = workspace.getInstallState().installedById;

  const core: AvailablePluginMessageDomain = {
    id: "Core:Text",
    label: "Core:Text",
    colorVar: "--cp-domain-core",
    pluginIdHint: "core.text",
    version: "1.0.0",
  };

  const unique = new Map<string, AvailablePluginMessageDomain>();
  unique.set(core.id, core);

  for (const plugin of catalog) {
    const installed = install[plugin.pluginId];
    const enabled = Boolean(installed?.enabled) && installed.status === "ok";
    if (!enabled) continue;
    for (const domain of plugin.providesDomains) {
      unique.set(domain.id, { ...domain, pluginIdHint: plugin.pluginId });
    }
  }

  return Array.from(unique.values());
}

export function resolveDomainPluginHint(serverSocket: string, domain: string): string {
  const socket = String(serverSocket ?? "").trim();
  const targetDomain = String(domain ?? "").trim();
  if (!targetDomain) return "";

  const workspace = createPluginsWorkspaceStateAccess(socket);
  const catalog = workspace.getCatalogState().catalog;
  for (const plugin of catalog) {
    for (const item of plugin.providesDomains) {
      if (item.label === targetDomain || item.id === targetDomain) return plugin.pluginId;
    }
  }

  const domainItem = workspace.getDomainCatalogItem(targetDomain);
  if (!domainItem) return "";
  for (const provider of domainItem.providers ?? []) {
    if (provider.type === "plugin" && String(provider.pluginId ?? "").trim()) {
      return String(provider.pluginId).trim();
    }
  }
  return "";
}
