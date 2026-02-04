/**
 * @fileoverview UninstallPlugin.ts
 * @description Usecase: uninstall a plugin.
 */

import type { PluginManagerPort } from "../ports/PluginManagerPort";

/**
 * Uninstall plugin usecase.
 */
export class UninstallPlugin {
  constructor(private readonly manager: PluginManagerPort) {}

  /**
   * Execute uninstall plugin.
   *
   * @param serverSocket - Server socket.
   * @param pluginId - Plugin id.
   * @returns Promise<void>.
   */
  execute(serverSocket: string, pluginId: string): Promise<void> {
    return this.manager.uninstall(serverSocket, pluginId);
  }
}
