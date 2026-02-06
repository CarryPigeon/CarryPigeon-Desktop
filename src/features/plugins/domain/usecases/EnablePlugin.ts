/**
 * @fileoverview EnablePlugin.ts
 * @description plugins｜用例：EnablePlugin。
 */

import type { PluginManagerPort, PluginProgressHandler } from "../ports/PluginManagerPort";
import type { InstalledPluginState } from "../types/pluginTypes";

/**
 * 用例：启用插件。
 */
export class EnablePlugin {
  constructor(private readonly manager: PluginManagerPort) {}

  /**
   * 执行：启用插件（必要时可能触发安装/切换版本等准备动作）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @param onProgress - 进度回调（可选）。
   * @returns 启用后的插件状态。
   */
  execute(
    serverSocket: string,
    pluginId: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    return this.manager.enable(serverSocket, pluginId, onProgress);
  }
}
