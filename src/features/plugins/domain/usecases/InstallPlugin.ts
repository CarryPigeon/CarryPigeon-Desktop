/**
 * @fileoverview InstallPlugin.ts
 * @description Usecase: install a plugin version.
 */

import type { PluginManagerPort, PluginProgressHandler } from "../ports/PluginManagerPort";
import type { InstalledPluginState } from "../types/pluginTypes";

/**
 * Install plugin usecase.
 */
export class InstallPlugin {
  constructor(private readonly manager: PluginManagerPort) {}

  /**
   * Execute install plugin.
   *
   * @param serverSocket - Server socket.
   * @param pluginId - Plugin id.
   * @param version - Version to install.
   * @param onProgress - Optional progress handler.
   * @returns Installed plugin state.
   */
  execute(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    return this.manager.install(serverSocket, pluginId, version, onProgress);
  }
}
