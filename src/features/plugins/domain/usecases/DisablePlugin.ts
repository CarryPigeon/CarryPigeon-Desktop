/**
 * @fileoverview DisablePlugin.ts
 * @description Usecase: disable an enabled plugin.
 */

import type { PluginManagerPort } from "../ports/PluginManagerPort";
import type { InstalledPluginState } from "../types/pluginTypes";

/**
 * Disable plugin usecase.
 */
export class DisablePlugin {
  constructor(private readonly manager: PluginManagerPort) {}

  /**
   * Execute disable plugin.
   *
   * @param serverSocket - Server socket.
   * @param pluginId - Plugin id.
   * @returns Installed plugin state or null.
   */
  execute(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null> {
    return this.manager.disable(serverSocket, pluginId);
  }
}
