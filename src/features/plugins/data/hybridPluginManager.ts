/**
 * @fileoverview hybridPluginManager.ts
 * @description plugins｜数据层实现：hybridPluginManager。
 * - Catalog list: fetched from the server via HTTP `/api/plugins/catalog`
 * - Lifecycle actions (install/enable/update/...): delegated to the Tauri adapter
 *
 * Rationale:
 * - The plugin catalog is a server concern (discovery + download pointer).
 * - Installation and runtime enablement are client-local concerns.
 * - This hybrid keeps the existing UI stores working while landing the new API.
 */

import type { PluginManagerPort, PluginProgressHandler } from "@/features/plugins/domain/ports/PluginManagerPort";
import type { InstalledPluginState, PluginCatalogEntry } from "@/features/plugins/domain/types/pluginTypes";
import { fetchServerPluginCatalog } from "@/features/plugins/data/httpPluginCatalog";
import { tauriPluginManager } from "@/features/plugins/data/tauriPluginManager";

/**
 * Hybrid plugin manager.
 *
 * @constant
 */
export const hybridPluginManager: PluginManagerPort = {
  async listCatalog(serverSocket: string): Promise<PluginCatalogEntry[]> {
    return fetchServerPluginCatalog(serverSocket);
  },

  async listInstalled(serverSocket: string): Promise<InstalledPluginState[]> {
    return tauriPluginManager.listInstalled(serverSocket);
  },

  async getInstalledState(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null> {
    return tauriPluginManager.getInstalledState(serverSocket, pluginId);
  },

  async install(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    return tauriPluginManager.install(serverSocket, pluginId, version, onProgress);
  },

  async installFromUrl(
    serverSocket: string,
    pluginId: string,
    version: string,
    url: string,
    sha256: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    return tauriPluginManager.installFromUrl(serverSocket, pluginId, version, url, sha256, onProgress);
  },

  async switchVersion(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    return tauriPluginManager.switchVersion(serverSocket, pluginId, version, onProgress);
  },

  async enable(serverSocket: string, pluginId: string, onProgress?: PluginProgressHandler): Promise<InstalledPluginState> {
    return tauriPluginManager.enable(serverSocket, pluginId, onProgress);
  },

  async disable(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null> {
    return tauriPluginManager.disable(serverSocket, pluginId);
  },

  async setFailed(serverSocket: string, pluginId: string, message: string): Promise<InstalledPluginState> {
    return tauriPluginManager.setFailed(serverSocket, pluginId, message);
  },

  async clearError(serverSocket: string, pluginId: string): Promise<InstalledPluginState> {
    return tauriPluginManager.clearError(serverSocket, pluginId);
  },

  async uninstall(serverSocket: string, pluginId: string): Promise<void> {
    return tauriPluginManager.uninstall(serverSocket, pluginId);
  },
};
