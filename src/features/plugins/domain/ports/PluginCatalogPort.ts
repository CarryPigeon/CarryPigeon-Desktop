/**
 * @fileoverview PluginCatalogPort.ts
 * @description plugins｜领域端口：PluginCatalogPort（目录查询能力）。
 */

import type { PluginCatalogEntry } from "../types/pluginTypes";

/**
 * 插件目录查询端口（只读能力）。
 *
 * 说明：
 * - 用于承载 catalog 读路径，避免与安装生命周期命令端口耦合；
 * - 安装/启停/切换等能力由 `PluginLifecycleCommandPort` 负责。
 */
export interface PluginCatalogPort {
  /**
   * 拉取服务端插件目录。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @returns 目录条目数组。
   */
  listCatalog(serverSocket: string): Promise<PluginCatalogEntry[]>;
}
