/**
 * @fileoverview GetInstalledPluginState.ts
 * @description Usecase: get installed state for a specific plugin.
 */

import type { PluginManagerPort } from "../ports/PluginManagerPort";
import type { InstalledPluginState } from "../types/pluginTypes";

/**
 * Get installed plugin state usecase.
 */
export class GetInstalledPluginState {
  constructor(private readonly manager: PluginManagerPort) {}

  /**
   * Execute get installed plugin state.
   *
   * @param serverSocket - Server socket.
   * @param pluginId - Plugin id.
   * @returns Installed plugin state or null.
   */
  execute(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null> {
    return this.manager.getInstalledState(serverSocket, pluginId);
  }
}
