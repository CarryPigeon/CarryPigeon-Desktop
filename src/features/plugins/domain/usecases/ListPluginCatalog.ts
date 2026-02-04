/**
 * @fileoverview ListPluginCatalog.ts
 * @description Usecase: list available plugins from catalog.
 */

import type { PluginManagerPort } from "../ports/PluginManagerPort";
import type { PluginCatalogEntry } from "../types/pluginTypes";

/**
 * List plugin catalog usecase.
 */
export class ListPluginCatalog {
  constructor(private readonly manager: PluginManagerPort) {}

  /**
   * Execute list plugin catalog.
   *
   * @param serverSocket - Server socket.
   * @returns Plugin catalog entries.
   */
  execute(serverSocket: string): Promise<PluginCatalogEntry[]> {
    return this.manager.listCatalog(serverSocket);
  }
}
