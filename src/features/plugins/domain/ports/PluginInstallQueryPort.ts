/**
 * @fileoverview PluginInstallQueryPort.ts
 * @description plugins｜领域端口：插件安装态查询（Query）。
 */

import type { InstalledPluginState } from "../types/pluginTypes";

/**
 * 插件安装态查询端口（只读）。
 */
export interface PluginInstallQueryPort {
  /**
   * 列出已安装插件状态。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @returns 已安装状态数组。
   */
  listInstalled(serverSocket: string): Promise<InstalledPluginState[]>;

  /**
   * 获取单个插件的已安装状态。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @returns 已安装状态；未安装时返回 `null`。
   */
  getInstalledState(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null>;
}
