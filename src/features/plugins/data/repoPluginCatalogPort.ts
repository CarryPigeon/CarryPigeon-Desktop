/**
 * @fileoverview repoPluginCatalogPort.ts
 * @description plugins｜数据层实现：RepoPluginCatalogPort（HTTP fetch）。
 */

import type { RepoPluginCatalogPort } from "../domain/ports/RepoPluginCatalogPort";
import type { PluginCatalogEntry } from "../domain/types/pluginTypes";
import { fetchRepoPluginCatalog } from "./httpRepoPluginCatalog";

/**
 * HTTP fetch 版本的 RepoPluginCatalogPort。
 *
 * @constant
 */
export const repoPluginCatalogPort: RepoPluginCatalogPort = {
  fetch(repoBase: string): Promise<PluginCatalogEntry[]> {
    return fetchRepoPluginCatalog(repoBase);
  },
};

