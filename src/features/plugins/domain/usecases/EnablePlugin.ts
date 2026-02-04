/**
 * @fileoverview EnablePlugin.ts
 * @description Usecase: enable an installed plugin.
 */

import type { PluginManagerPort, PluginProgressHandler } from "../ports/PluginManagerPort";
import type { InstalledPluginState } from "../types/pluginTypes";

/**
 * Enable plugin usecase.
 */
export class EnablePlugin {
  constructor(private readonly manager: PluginManagerPort) {}

  /**
   * Execute enable plugin.
   *
   * @param serverSocket - Server socket.
   * @param pluginId - Plugin id.
   * @param onProgress - Optional progress handler.
   * @returns Installed plugin state.
   */
  execute(
    serverSocket: string,
    pluginId: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    return this.manager.enable(serverSocket, pluginId, onProgress);
  }
}
