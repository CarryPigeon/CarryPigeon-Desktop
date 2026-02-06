/**
 * @fileoverview plugins Feature 对外公共 API（跨 Feature 访问边界）。
 * @description
 * 跨 Feature 协作（auth/chat/main 等）统一通过本文件访问 plugins 能力。
 */

export {
  addRepoSource,
  enabledRepoSources,
  removeRepoSource,
  repoSources,
  setRepoSourceEnabled,
  useDomainCatalogStore,
  useDomainRegistryStore,
  usePluginCatalogStore,
  usePluginInstallStore,
  type RepoSource,
} from "./presentation/store";

export {
  createDomainCatalogContext,
  type DomainCatalogContext,
} from "./presentation/composables/useDomainCatalogContext";

export { createPluginContext, type PluginContext } from "./presentation/composables/usePluginContext";

export {
  getDomainCatalogPort,
  getPluginManagerPort,
  getRepoPluginCatalogPort,
} from "./di/plugins.di";

export type {
  PluginComposerPayload,
  PluginContext as RuntimePluginContext,
} from "./domain/types/pluginRuntimeTypes";

export type { InstalledPluginState, PluginCatalogEntry, PluginProgress } from "./domain/types/pluginTypes";
