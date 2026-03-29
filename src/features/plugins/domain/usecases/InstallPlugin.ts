/**
 * @fileoverview InstallPlugin.ts
 * @description plugins｜用例：InstallPlugin。
 */

import type { PluginLifecycleCommandPort, PluginProgressHandler } from "../ports/PluginLifecycleCommandPort";
import type { InstalledPluginState } from "../types/pluginTypes";

/**
 * 用例：安装插件。
 */
export class InstallPlugin {
  constructor(private readonly commandPort: PluginLifecycleCommandPort) {}

  /**
   * 执行：安装指定版本的插件。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @param version - 需要安装的版本号。
   * @param onProgress - 安装进度回调（可选）。
   * @returns 安装后的插件状态。
   */
  execute(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    return this.commandPort.install(serverSocket, pluginId, version, onProgress);
  }
}
