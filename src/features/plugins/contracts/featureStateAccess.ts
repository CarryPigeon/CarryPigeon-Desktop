/**
 * @fileoverview plugins feature state access contracts。
 * @description
 * 为 application 层定义稳定的 feature-state 访问契约，隔离 presentation/store 实现细节。
 */

import type { DomainCatalogItem } from "../domain/types/domainCatalogTypes";
import type { PluginContext } from "../domain/types/pluginRuntimeTypes";
import type {
  InstalledPluginState,
  PluginCatalogEntryLike,
  PluginProgress,
} from "../domain/types/pluginTypes";
import type { DomainBinding, DomainRegistryHostBridge } from "./domainRegistry";
import type {
  DisablePluginOutcome,
  EnablePluginOutcome,
  InstallPluginOutcome,
  RollbackPluginOutcome,
  SwitchPluginVersionOutcome,
  UninstallPluginOutcome,
  UpdatePluginToLatestOutcome,
} from "../application/pluginCommandOutcome";

export type PluginsRuntimeLifecycleAccess = {
  start(): void;
  stop(): Promise<void>;
};

export type PluginsWorkspaceCatalogState = {
  catalog: readonly PluginCatalogEntryLike[];
  catalogById: Record<string, PluginCatalogEntryLike>;
  catalogLoading: boolean;
  catalogError: string;
};

export type PluginsWorkspaceInstallState = {
  installedById: Record<string, InstalledPluginState>;
  progressById: Record<string, PluginProgress | null>;
  busyPluginIds: readonly string[];
  missingRequiredIds: readonly string[];
};

export type PluginsWorkspaceStateAccess = {
  getCatalogState(): PluginsWorkspaceCatalogState;
  getInstallState(): PluginsWorkspaceInstallState;
  refreshDomainCatalog(): Promise<void>;
  refreshCatalog(): Promise<void>;
  refreshInstalled(): Promise<void>;
  recheckRequired(requiredIds: readonly string[]): void;
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
  getDomainCatalogItem(domain: string): DomainCatalogItem | null;
};

export type PluginsRuntimeStateAccess = {
  ensureLoaded(): Promise<void>;
  getBinding(domain: string): DomainBinding | null;
  getContextForPlugin(pluginId: string): PluginContext | null;
  getContextForDomain(domain: string): PluginContext | null;
  setHostBridge(bridge: DomainRegistryHostBridge | null): void;
};
