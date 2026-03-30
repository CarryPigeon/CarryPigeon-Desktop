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

/**
 * 刷新当前 server 对应的 chat domain 目录。
 */
export function refreshChatDomainCatalog(serverSocket: string): Promise<void> {
  return pluginsCapabilities.forServer(serverSocket).refreshDomainCatalog();
}

/**
 * 确保当前 server 的插件运行时已加载。
 */
export function ensureChatPluginRuntimeLoaded(serverSocket: string): Promise<void> {
  return pluginsCapabilities.forServer(serverSocket).ensureRuntimeLoaded();
}

/**
 * 为当前 server 安装 chat host bridge。
 *
 * host bridge 负责把“发送消息、打开能力”等宿主动作暴露给插件 runtime。
 */
export function attachChatPluginHostBridge(serverSocket: string, bridge: DomainRegistryHostBridge): void {
  pluginsCapabilities.forServer(serverSocket).attachHostBridge(bridge);
}

/**
 * 卸载当前 server 的 chat host bridge。
 */
export function detachChatPluginHostBridge(serverSocket: string): void {
  pluginsCapabilities.forServer(serverSocket).detachHostBridge();
}

/**
 * 读取当前 server 对应的 domain registry runtime capability。
 */
export function getChatDomainRegistryView(serverSocket: string) {
  return pluginsCapabilities.forServer(serverSocket).getRuntimeCapabilities();
}

/**
 * 读取当前 server 下 chat 可用的消息 domain 列表。
 */
export function getAvailableChatMessageDomains(serverSocket: string) {
  return pluginsCapabilities.forServer(serverSocket).getAvailableMessageDomains();
}

/**
 * 解析某个消息 domain 对应的插件提示信息。
 */
export function resolveChatDomainPluginHint(serverSocket: string, domain: string): string {
  return pluginsCapabilities.forServer(serverSocket).resolveDomainPluginHint(domain);
}

/**
 * 插件 composer 向 chat 宿主提交的消息 payload 语义。
 */
export type { PluginComposerPayload };
