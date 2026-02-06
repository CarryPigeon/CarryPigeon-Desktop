/**
 * @fileoverview GetInstalledPluginState.ts
 * @description plugins｜用例：GetInstalledPluginState。
 */

import type { PluginManagerPort } from "../ports/PluginManagerPort";
import type { InstalledPluginState } from "../types/pluginTypes";

/**
 * 用例：获取已安装插件状态。
 */
export class GetInstalledPluginState {
  constructor(private readonly manager: PluginManagerPort) {}

  /**
   * 执行：查询指定插件在当前 server scope 下的安装状态。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @returns 插件安装状态；若未安装则为 `null`。
   */
  execute(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null> {
    return this.manager.getInstalledState(serverSocket, pluginId);
  }
}
