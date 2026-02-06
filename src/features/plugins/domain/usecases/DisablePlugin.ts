/**
 * @fileoverview DisablePlugin.ts
 * @description plugins｜用例：DisablePlugin。
 */

import type { PluginManagerPort } from "../ports/PluginManagerPort";
import type { InstalledPluginState } from "../types/pluginTypes";

/**
 * 用例：禁用插件。
 */
export class DisablePlugin {
  constructor(private readonly manager: PluginManagerPort) {}

  /**
   * 执行：禁用插件（仅改变启用状态，不一定卸载文件）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @returns 禁用后的插件状态；若插件未安装则为 `null`。
   */
  execute(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null> {
    return this.manager.disable(serverSocket, pluginId);
  }
}
