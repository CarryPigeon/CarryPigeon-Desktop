/**
 * @fileoverview ListInstalledPlugins.ts
 * @description plugins｜用例：ListInstalledPlugins。
 */

import type { PluginManagerPort } from "../ports/PluginManagerPort";
import type { InstalledPluginState } from "../types/pluginTypes";

/**
 * 用例：列出已安装插件。
 */
export class ListInstalledPlugins {
  constructor(private readonly manager: PluginManagerPort) {}

  /**
   * 执行：列出当前 server scope 下所有已安装插件状态。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @returns 已安装插件状态列表。
   */
  execute(serverSocket: string): Promise<InstalledPluginState[]> {
    return this.manager.listInstalled(serverSocket);
  }
}
