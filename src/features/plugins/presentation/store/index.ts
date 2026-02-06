/**
 * @fileoverview plugins｜presentation/store 公共入口。
 * @description
 * 对外约定：
 * - 跨 feature 引用 plugins 的 store，请优先从本入口导入，避免深层路径耦合；
 * - 本入口只做 re-export，不引入额外副作用逻辑；
 * - 如遇循环依赖，可临时深层导入，但需在调用点注明原因与迁移目标。
 */

export { usePluginCatalogStore } from "./pluginCatalogStore";
export { usePluginInstallStore } from "./pluginInstallStore";
export { useDomainCatalogStore } from "./domainCatalogStore";
export { useDomainRegistryStore } from "./domainRegistryStore";

export {
  addRepoSource,
  enabledRepoSources,
  removeRepoSource,
  repoSources,
  setRepoSourceEnabled,
  type RepoSource,
} from "./repoSourcesStore";

