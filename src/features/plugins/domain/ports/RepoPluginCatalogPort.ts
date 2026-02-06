/**
 * @fileoverview RepoPluginCatalogPort.ts
 * @description plugins｜领域端口：RepoPluginCatalogPort。
 *
 * 说明：
 * - Repo catalog 可能由第三方托管，不一定与聊天服务端同源；
 * - 该端口用于让 presentation 层通过 DI/usecase 获取 repo 目录能力，避免直接依赖 data 实现。
 */

import type { PluginCatalogEntry } from "../types/pluginTypes";

/**
 * Repo 插件目录端口（领域层）。
 */
export interface RepoPluginCatalogPort {
  /**
   * 拉取 repo 托管的插件目录。
   *
   * @param repoBase - Repo base URL（例如 `https://repo.example.com`）。
   * @returns 插件目录条目列表（source=`repo`）。
   */
  fetch(repoBase: string): Promise<PluginCatalogEntry[]>;
}

