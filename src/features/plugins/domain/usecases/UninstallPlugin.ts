/**
 * @fileoverview UninstallPlugin.ts
 * @description plugins｜用例：UninstallPlugin。
 */

import type { PluginLifecycleCommandPort } from "../ports/PluginLifecycleCommandPort";

/**
 * 用例：卸载插件。
 */
export class UninstallPlugin {
  constructor(private readonly commandPort: PluginLifecycleCommandPort) {}

  /**
   * 执行：卸载指定插件（从当前 server scope 移除）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @returns 无返回值。
   */
  execute(serverSocket: string, pluginId: string): Promise<void> {
    return this.commandPort.uninstall(serverSocket, pluginId);
  }
}
