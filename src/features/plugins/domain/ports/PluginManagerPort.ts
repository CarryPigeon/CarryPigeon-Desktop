/**
 * @fileoverview PluginManagerPort.ts
 * @description plugins｜领域端口：PluginManagerPort。
 */

import type { InstalledPluginState, PluginCatalogEntry, PluginProgress } from "../types/pluginTypes";

/**
 * 插件安装/切换进度回调。
 *
 * @param progress - 进度对象（stage/percent/message）。
 * @returns 无返回值。
 */
export type PluginProgressHandler = (progress: PluginProgress) => void;

/**
 * 插件管理端口（domain 层）。
 *
 * 说明：
 * - 该端口抽象“插件目录/安装/启用/切换/卸载”等能力；
 * - 具体实现位于 data 层（tauri vs mock）。
 */
export interface PluginManagerPort {
  /**
   * 拉取插件目录（包含 server 与 repo 来源）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @returns 插件目录条目数组。
   */
  listCatalog(serverSocket: string): Promise<PluginCatalogEntry[]>;
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
  /**
   * 从服务端目录安装插件指定版本。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @param version - 目标版本。
   * @param onProgress - 可选进度回调。
   * @returns 安装后的状态。
   */
  install(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState>;
  /**
   * 从 URL 安装插件（repo/自定义来源）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @param version - 目标版本。
   * @param url - zip 下载 URL。
   * @param sha256 - zip 的 sha256 校验值（hex）。
   * @param onProgress - 可选进度回调。
   * @returns 安装后的状态。
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
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @param version - 目标版本。
   * @param onProgress - 可选进度回调。
   * @returns 切换后的状态。
   */
  switchVersion(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState>;
  /**
   * 启用插件。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @param onProgress - 可选进度回调。
   * @returns 启用后的状态。
   */
  enable(serverSocket: string, pluginId: string, onProgress?: PluginProgressHandler): Promise<InstalledPluginState>;
  /**
   * 禁用插件。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @returns 禁用后的状态；未安装时返回 `null`。
   */
  disable(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null>;
  /**
   * 将插件标记为失败态（通常由运行时加载失败触发）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @param message - 失败原因（人类可读）。
   * @returns 更新后的状态。
   */
  setFailed(serverSocket: string, pluginId: string, message: string): Promise<InstalledPluginState>;
  /**
   * 清空插件失败信息并恢复为 ok（不改变安装版本）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @returns 更新后的状态。
   */
  clearError(serverSocket: string, pluginId: string): Promise<InstalledPluginState>;
  /**
   * 卸载插件（删除本地安装目录）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param pluginId - 插件 id。
   * @returns 无返回值。
   */
  uninstall(serverSocket: string, pluginId: string): Promise<void>;
}
