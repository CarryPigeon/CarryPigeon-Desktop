/**
 * @fileoverview account/auth-flow plugin workspace integration
 * @description
 * 为 required-setup 页面提供本地响应式插件工作区，避免 account 直接把 plugins 的 plain capability 形状扩散到 UI。
 */

import { computed, type ComputedRef } from "vue";
import { getPluginsCapabilities } from "@/features/plugins/api";
import type {
  DisablePluginOutcome,
  EnablePluginOutcome,
  InstallPluginOutcome,
  RollbackPluginOutcome,
  SwitchPluginVersionOutcome,
  UninstallPluginOutcome,
  UpdatePluginToLatestOutcome,
} from "@/features/plugins/api-types";

const pluginsCapabilities = getPluginsCapabilities();

type PluginsCapabilities = ReturnType<typeof getPluginsCapabilities>;
type PluginsWorkspaceCapabilities = ReturnType<PluginsCapabilities["workspace"]["createCapabilities"]>;
type PluginsWorkspaceSnapshot = ReturnType<PluginsWorkspaceCapabilities["getSnapshot"]>;
type InstalledById = PluginsWorkspaceSnapshot["installedById"];
type ProgressById = PluginsWorkspaceSnapshot["progressById"];
type PluginCatalogEntryLike = PluginsWorkspaceSnapshot["catalog"][number];

export type RequiredSetupPluginsWorkspaceArgs = {
  socket: ComputedRef<string>;
  requiredPluginsDeclared: ComputedRef<readonly string[] | null>;
};

export type RequiredSetupPluginsWorkspace = {
  catalog: ComputedRef<readonly PluginCatalogEntryLike[]>;
  catalogById: ComputedRef<Record<string, PluginCatalogEntryLike>>;
  catalogLoading: ComputedRef<boolean>;
  catalogError: ComputedRef<string>;
  installedById: ComputedRef<InstalledById>;
  progressById: ComputedRef<ProgressById>;
  busyPluginIds: ComputedRef<readonly string[]>;
  missingRequiredIds: ComputedRef<readonly string[]>;
  requiredIds: ComputedRef<readonly string[]>;
  refreshCatalog(): Promise<void>;
  refreshInstalled(): Promise<void>;
  refreshInstalledAndRecheck(requiredIds?: readonly string[]): Promise<void>;
  recheckRequired(requiredIds?: readonly string[]): void;
  install(plugin: PluginCatalogEntryLike, version: string): Promise<InstallPluginOutcome>;
  updateToLatest(plugin: PluginCatalogEntryLike, latestVersion: string): Promise<UpdatePluginToLatestOutcome>;
  switchVersion(pluginId: string, version: string): Promise<SwitchPluginVersionOutcome>;
  rollback(pluginId: string): Promise<RollbackPluginOutcome>;
  enable(pluginId: string): Promise<EnablePluginOutcome>;
  disable(pluginId: string): Promise<DisablePluginOutcome>;
  uninstall(pluginId: string): Promise<UninstallPluginOutcome>;
  isInstalled(pluginId: string): boolean;
  isEnabled(pluginId: string): boolean;
  isFailed(pluginId: string): boolean;
};

export function createRequiredSetupPluginsWorkspace(
  args: RequiredSetupPluginsWorkspaceArgs,
): RequiredSetupPluginsWorkspace {
  const capabilities: PluginsWorkspaceCapabilities = pluginsCapabilities.workspace.createCapabilities({
    getServerSocket: () => args.socket.value,
    getRequiredPluginIds: () => args.requiredPluginsDeclared.value,
  });
  const snapshot = computed(() => capabilities.getSnapshot());

  return {
    catalog: computed(() => snapshot.value.catalog),
    catalogById: computed(() => snapshot.value.catalogById),
    catalogLoading: computed(() => snapshot.value.catalogLoading),
    catalogError: computed(() => snapshot.value.catalogError),
    installedById: computed(() => snapshot.value.installedById),
    progressById: computed(() => snapshot.value.progressById),
    busyPluginIds: computed(() => snapshot.value.busyPluginIds),
    missingRequiredIds: computed(() => snapshot.value.missingRequiredIds),
    requiredIds: computed(() => snapshot.value.requiredIds),
    refreshCatalog: capabilities.refreshCatalog,
    refreshInstalled: capabilities.refreshInstalled,
    refreshInstalledAndRecheck: capabilities.refreshInstalledAndRecheck,
    recheckRequired: capabilities.recheckRequired,
    install: capabilities.install,
    updateToLatest: capabilities.updateToLatest,
    switchVersion: capabilities.switchVersion,
    rollback: capabilities.rollback,
    enable: capabilities.enable,
    disable: capabilities.disable,
    uninstall: capabilities.uninstall,
    isInstalled: capabilities.isInstalled,
    isEnabled: capabilities.isEnabled,
    isFailed: capabilities.isFailed,
  };
}
