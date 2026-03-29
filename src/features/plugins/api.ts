/**
 * @fileoverview plugins Feature 对外公共 API。
 * @description
 * 默认通过 object-capability 公开公共能力。
 *
 * 边界约定：
 * - 跨 feature 运行时能力通过本文件导出；
 * - 跨 feature 类型约束通过 `src/features/plugins/api-types.ts` 导出；
 * - `plugins/presentation/*`、`plugins/di/*`、`plugins/data/*` 等路径均属于 feature 内部实现。
 */

import { startPluginsRuntime as startPluginsRuntimeInternal } from "./application/startPluginsRuntime";
import { stopPluginsRuntime as stopPluginsRuntimeInternal } from "./application/stopPluginsRuntime";
import { resolveLatestPluginCatalogVersion as resolveLatestPluginCatalogVersionInternal } from "./domain/types/pluginTypes";
import { createRuntimeLeaseController } from "@/shared/utils/runtimeLease";
import {
  createPluginsWorkspaceCapabilities as createPluginsWorkspaceCapabilitiesInternal,
  listInstalledPlugins as listInstalledPluginsInternal,
  refreshDomainCatalog as refreshDomainCatalogInternal,
} from "./internal/workspaceAccess";
import {
  attachPluginHostBridge as attachPluginHostBridgeInternal,
  detachPluginHostBridge as detachPluginHostBridgeInternal,
  ensurePluginRuntimeLoaded as ensurePluginRuntimeLoadedInternal,
  getAvailableMessageDomains as getAvailableMessageDomainsInternal,
  getPluginRuntimeCapabilities as getPluginRuntimeCapabilitiesInternal,
  resolveDomainPluginHint as resolveDomainPluginHintInternal,
} from "./internal/runtimeAccess";
import type { PluginsCapabilities } from "./api-types";

const pluginsRuntimeLeaseController = createRuntimeLeaseController({
  start(): Promise<void> {
    return Promise.resolve().then(() => {
      startPluginsRuntimeInternal();
    });
  },
  stop(): Promise<void> {
    return stopPluginsRuntimeInternal();
  },
});

export function createPluginsCapabilities(): PluginsCapabilities {
  return {
    workspace: {
      createCapabilities: createPluginsWorkspaceCapabilitiesInternal,
    },
    catalog: {
      resolveLatestVersion: resolveLatestPluginCatalogVersionInternal,
    },
    runtime: {
      acquireLease() {
        return pluginsRuntimeLeaseController.acquireLease();
      },
    },
    forServer(serverSocket) {
      return {
        listInstalledPlugins() {
          return listInstalledPluginsInternal(serverSocket);
        },
        refreshDomainCatalog() {
          return refreshDomainCatalogInternal(serverSocket);
        },
        ensureRuntimeLoaded() {
          return ensurePluginRuntimeLoadedInternal(serverSocket);
        },
        getRuntimeCapabilities() {
          return getPluginRuntimeCapabilitiesInternal(serverSocket);
        },
        attachHostBridge(bridge) {
          attachPluginHostBridgeInternal(serverSocket, bridge);
        },
        detachHostBridge() {
          detachPluginHostBridgeInternal(serverSocket);
        },
        getAvailableMessageDomains() {
          return getAvailableMessageDomainsInternal(serverSocket);
        },
        resolveDomainPluginHint(domain) {
          return resolveDomainPluginHintInternal(serverSocket, domain);
        },
      };
    },
  };
}

let pluginsCapabilitiesSingleton: PluginsCapabilities | null = null;

export function getPluginsCapabilities(): PluginsCapabilities {
  if (pluginsCapabilitiesSingleton) return pluginsCapabilitiesSingleton;
  pluginsCapabilitiesSingleton = createPluginsCapabilities();
  return pluginsCapabilitiesSingleton;
}
