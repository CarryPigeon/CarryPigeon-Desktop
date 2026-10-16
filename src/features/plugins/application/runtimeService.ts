/**
 * @fileoverview plugins runtime application facade。
 * @description
 * 收敛运行时加载、host bridge 与 domain 查询能力，避免根 capability 入口直接依赖展示层 store。
 */

import type { DomainBinding, DomainRegistryHostBridge } from "../contracts/domainRegistry";
import type { PluginSettingsContribution } from "../domain/types/pluginRuntimeTypes";
import { createPluginsRuntimeStateAccess, createPluginsWorkspaceStateAccess } from "../di/plugins.di";
import { dedupeAsyncByKey } from "@/shared/utils/asyncDedupe";

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
  getContextForPlugin(pluginId: string): unknown;
  getContextForDomain(domain: string): unknown;
  listSettingsItems(): readonly PluginSettingsContribution[];
};

export async function ensurePluginRuntimeLoaded(serverSocket: string): Promise<void> {
  const socket = String(serverSocket ?? "").trim();
  if (!socket) return;
  // 并发去重：设置页与聊天页可能同时触发同一 server 的运行时加载，重复执行会
  // 走「先 disable 再 enable」造成无谓的插件重载。
  await dedupeAsyncByKey(`plugins:runtime:ensureLoaded:${socket}`, () =>
    createPluginsRuntimeStateAccess(socket).ensureLoaded(),
  );
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
    listSettingsItems() {
      return runtime.listSettingsItems();
    },
  };
}

/**
 * 列出指定 server 下插件注册的设置项。
 *
 * @param serverSocket - 目标 server socket。
 * @returns 设置项列表（只读视图；无该 server 运行时 → 空列表）。
 */
export function listPluginSettingsItems(serverSocket: string): readonly PluginSettingsContribution[] {
  const socket = String(serverSocket ?? "").trim();
  if (!socket) return [];
  return createPluginsRuntimeStateAccess(socket).listSettingsItems();
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

  // 内置语音域：与 Core:Text 同级出现在 composer 域选择器（录制 UI 作为该域的编辑器）。
  const coreVoice: AvailablePluginMessageDomain = {
    id: "Core:Voice",
    label: "Core:Voice",
    colorVar: "--cp-domain-core",
    pluginIdHint: "core.voice",
    version: "1.0.0",
  };

  const unique = new Map<string, AvailablePluginMessageDomain>();
  unique.set(core.id, core);
  unique.set(coreVoice.id, coreVoice);

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
