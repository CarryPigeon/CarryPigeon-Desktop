/**
 * @fileoverview PluginLifecycleCommandPort.ts
 * @description plugins｜领域端口：插件生命周期命令（Command）。
 */

import type { InstalledPluginState, PluginProgress } from "../types/pluginTypes";

/**
 * 插件安装/切换进度回调。
 *
 * @param progress - 进度对象（stage/percent/message）。
 * @returns 无返回值。
 */
export type PluginProgressHandler = (progress: PluginProgress) => void;

/**
 * 插件生命周期命令端口（写能力）。
 */
export interface PluginLifecycleCommandPort {
  /**
   * 从服务端目录安装插件指定版本。
   */
  install(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState>;

  /**
   * 从 URL 安装插件（repo/自定义来源）。
   */
  installFromUrl(
    serverSocket: string,
    pluginId: string,
    version: string,
    url: string,
    sha256: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState>;

  /**
   * 切换插件到指定版本（要求该版本已安装）。
   */
  switchVersion(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState>;

  /**
   * 启用插件。
   */
  enable(serverSocket: string, pluginId: string, onProgress?: PluginProgressHandler): Promise<InstalledPluginState>;

  /**
   * 禁用插件。
   */
  disable(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null>;

  /**
   * 将插件标记为失败态。
   */
  setFailed(serverSocket: string, pluginId: string, message: string): Promise<InstalledPluginState>;

  /**
   * 清空插件失败信息并恢复为 ok。
   */
  clearError(serverSocket: string, pluginId: string): Promise<InstalledPluginState>;

  /**
   * 卸载插件。
   */
  uninstall(serverSocket: string, pluginId: string): Promise<void>;
}
