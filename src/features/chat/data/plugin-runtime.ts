/**
 * @fileoverview chat/pluginRuntime integration
 * @description
 * 为 chat feature 提供统一的插件运行时与消息 domain 能力入口。
 */

import { getPluginsCapabilities } from "@/features/plugins/api";

const pluginsCapabilities = getPluginsCapabilities();
type PluginsServerCapabilities = ReturnType<ReturnType<typeof getPluginsCapabilities>["forServer"]>;
type DomainRegistryHostBridge = Parameters<PluginsServerCapabilities["attachHostBridge"]>[0];
type PluginComposerPayload = Parameters<DomainRegistryHostBridge["sendMessage"]>[0];

export function refreshChatDomainCatalog(serverSocket: string): Promise<void> {
  return pluginsCapabilities.forServer(serverSocket).refreshDomainCatalog();
}

export function ensureChatPluginRuntimeLoaded(serverSocket: string): Promise<void> {
  return pluginsCapabilities.forServer(serverSocket).ensureRuntimeLoaded();
}

export function attachChatPluginHostBridge(serverSocket: string, bridge: DomainRegistryHostBridge): void {
  pluginsCapabilities.forServer(serverSocket).attachHostBridge(bridge);
}

export function detachChatPluginHostBridge(serverSocket: string): void {
  pluginsCapabilities.forServer(serverSocket).detachHostBridge();
}

export function getChatDomainRegistryView(serverSocket: string) {
  return pluginsCapabilities.forServer(serverSocket).getRuntimeCapabilities();
}

export function getAvailableChatMessageDomains(serverSocket: string) {
  return pluginsCapabilities.forServer(serverSocket).getAvailableMessageDomains();
}

export function resolveChatDomainPluginHint(serverSocket: string, domain: string): string {
  return pluginsCapabilities.forServer(serverSocket).resolveDomainPluginHint(domain);
}

export type { PluginComposerPayload };
