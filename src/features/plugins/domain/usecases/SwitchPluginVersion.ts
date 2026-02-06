/**
 * @fileoverview SwitchPluginVersion.ts
 * @description plugins｜用例：SwitchPluginVersion。
 */

import type { PluginManagerPort, PluginProgressHandler } from "../ports/PluginManagerPort";
import type { InstalledPluginState } from "../types/pluginTypes";

/**
 * 用例：切换插件版本。
 */
export class SwitchPluginVersion {
  constructor(private readonly manager: PluginManagerPort) {}

  /**
   * 执行：切换插件到目标版本（通常会触发下载/校验/解压/切换 currentVersion 等流程）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @param version - 目标版本号。
   * @param onProgress - 进度回调（可选）。
   * @returns 切换后的插件状态。
   */
  execute(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    return this.manager.switchVersion(serverSocket, pluginId, version, onProgress);
  }
}
