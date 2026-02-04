/**
 * @fileoverview PluginManagerPort.ts
 * @description Domain port: plugin catalog + install/enable lifecycle.
 */

import type { InstalledPluginState, PluginCatalogEntry, PluginProgress } from "../types/pluginTypes";

export type PluginProgressHandler = (progress: PluginProgress) => void;

export interface PluginManagerPort {
  listCatalog(serverSocket: string): Promise<PluginCatalogEntry[]>;
  listInstalled(serverSocket: string): Promise<InstalledPluginState[]>;
  getInstalledState(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null>;
  install(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState>;
  installFromUrl(
    serverSocket: string,
    pluginId: string,
    version: string,
    url: string,
    sha256: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState>;
  switchVersion(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState>;
  enable(serverSocket: string, pluginId: string, onProgress?: PluginProgressHandler): Promise<InstalledPluginState>;
  disable(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null>;
  setFailed(serverSocket: string, pluginId: string, message: string): Promise<InstalledPluginState>;
  clearError(serverSocket: string, pluginId: string): Promise<InstalledPluginState>;
  uninstall(serverSocket: string, pluginId: string): Promise<void>;
}
