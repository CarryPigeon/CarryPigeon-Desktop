/**
 * @fileoverview ListPluginCatalog.ts
 * @description plugins｜用例：ListPluginCatalog。
 */

import type { PluginCatalogPort } from "../ports/PluginCatalogPort";
import type { PluginCatalogEntry } from "../types/pluginTypes";

/**
 * 用例：获取插件目录（catalog）。
 */
export class ListPluginCatalog {
  constructor(private readonly catalogPort: PluginCatalogPort) {}

  /**
   * 执行：获取插件目录列表。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @returns 插件目录条目列表。
   */
  execute(serverSocket: string): Promise<PluginCatalogEntry[]> {
    return this.catalogPort.listCatalog(serverSocket);
  }
}
