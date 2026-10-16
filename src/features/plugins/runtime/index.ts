/**
 * @fileoverview plugins Cordis 运行时入口。
 */

export { applyPlugin, type AppliedPlugin, type ApplyPluginDeps } from "./applyPlugin";
export { createServerRuntime, type ServerRuntime, type ServerRuntimeOptions } from "./createServerContext";
export { createDomainsRegistry, type DomainsRegistry } from "./domainsRegistry";
export { createRuntimeGuard, isGuardDisposed, type RuntimeGuard } from "./guard";
export {
  createPluginSettingsRegistry,
  PLUGIN_SETTINGS_ITEM_LIMIT_PER_PLUGIN,
  type PluginSettingsRegistry,
} from "./pluginSettingsRegistry";
export { legacyToCordis, type PluginRuntimeModuleV1 } from "./legacyAdapter";
export { loadPluginRuntimeModule, normalizePluginRuntimeModule, type LoadedPluginRuntime } from "./loadPluginModule";
export {
  assertRequiredPermissions,
  CAPABILITY_SERVICE_NAMES,
  isServiceVisible,
  normalizePermissions,
  PERMISSIONS_BY_SERVICE,
  resolveInjectedServices,
} from "./permissions";
export { EXPOSABLE_IPC_NAMESPACES, resolveIpcPrefixes } from "./services/ipc";
export type { PluginUiBridge } from "./services/ui";
export type {
  Context,
  Plugin,
  PluginAiService,
  PluginDomainsService,
  PluginFetchResponse,
  PluginIpcService,
  PluginMessagesService,
  PluginNetworkService,
  PluginServerService,
  PluginStorageService,
  PluginUiService,
} from "./types";
