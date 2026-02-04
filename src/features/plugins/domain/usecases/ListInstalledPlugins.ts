/**
 * @fileoverview ListInstalledPlugins.ts
 * @description Usecase: list locally installed plugins.
 */

import type { PluginManagerPort } from "../ports/PluginManagerPort";
import type { InstalledPluginState } from "../types/pluginTypes";

/**
 * List installed plugins usecase.
 */
export class ListInstalledPlugins {
  constructor(private readonly manager: PluginManagerPort) {}

  /**
   * Execute list installed plugins.
   *
   * @param serverSocket - Server socket.
   * @returns Installed plugin states.
   */
  execute(serverSocket: string): Promise<InstalledPluginState[]> {
    return this.manager.listInstalled(serverSocket);
  }
}
