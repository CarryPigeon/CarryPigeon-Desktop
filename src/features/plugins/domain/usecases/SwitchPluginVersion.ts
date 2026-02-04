/**
 * @fileoverview SwitchPluginVersion.ts
 * @description Usecase: switch plugin to a different version.
 */

import type { PluginManagerPort, PluginProgressHandler } from "../ports/PluginManagerPort";
import type { InstalledPluginState } from "../types/pluginTypes";

/**
 * Switch plugin version usecase.
 */
export class SwitchPluginVersion {
  constructor(private readonly manager: PluginManagerPort) {}

  /**
   * Execute switch plugin version.
   *
   * @param serverSocket - Server socket.
   * @param pluginId - Plugin id.
   * @param version - Target version.
   * @param onProgress - Optional progress handler.
   * @returns Installed plugin state.
   */
  execute(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    return this.manager.switchVersion(serverSocket, pluginId, version, onProgress);
  }
}
