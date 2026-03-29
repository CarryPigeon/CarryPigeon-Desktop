/**
 * @fileoverview plugins workspace application facade。
 * @description
 * 收敛插件工作区快照、刷新与安装动作，避免根 capability 入口直接依赖展示层 store。
 */

import type { InstalledPluginState, PluginCatalogEntryLike, PluginProgress } from "../domain/types/pluginTypes";
import type {
  DisablePluginOutcome,
  EnablePluginOutcome,
  InstallPluginOutcome,
  RollbackPluginOutcome,
  SwitchPluginVersionOutcome,
  UninstallPluginOutcome,
  UpdatePluginToLatestOutcome,
} from "./pluginCommandOutcome";
import { createPluginsWorkspaceStateAccess } from "../di/plugins.di";
import { getListInstalledPluginsUsecase } from "../di/plugins.di";

export type PluginsWorkspaceSnapshot = {
  catalog: readonly PluginCatalogEntryLike[];
  catalogById: Record<string, PluginCatalogEntryLike>;
  catalogLoading: boolean;
  catalogError: string;
  installedById: Record<string, InstalledPluginState>;
  progressById: Record<string, PluginProgress | null>;
  busyPluginIds: readonly string[];
  missingRequiredIds: readonly string[];
  requiredIds: readonly string[];
};

export type PluginsWorkspaceCapabilitiesArgs = {
  getServerSocket(): string;
  getRequiredPluginIds(): readonly string[] | null;
};

export type PluginsWorkspaceCapabilities = {
  getSnapshot(): PluginsWorkspaceSnapshot;
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

function normalizeRequiredPluginIds(ids: readonly string[] | null | undefined): string[] {
  return (ids ?? []).map((x) => String(x).trim()).filter(Boolean);
}

function readRequiredPluginIdsSnapshot(serverSocket: string, declaredIds: readonly string[] | null): string[] {
  const normalizedDeclared = normalizeRequiredPluginIds(declaredIds);
  if (normalizedDeclared.length > 0) return normalizedDeclared;

  const out: string[] = [];
  const catalog = createPluginsWorkspaceStateAccess(serverSocket).getCatalogState().catalog;
  for (const plugin of catalog) {
    if (plugin.required) out.push(plugin.pluginId);
  }
  return out;
}

function freezeArrayCopy<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function freezeRecordCopy<T>(record: Record<string, T>): Readonly<Record<string, T>> {
  return Object.freeze({ ...record });
}

export function getPluginsWorkspaceSnapshot(
  serverSocket: string,
  declaredRequiredPluginIds: readonly string[] | null,
): PluginsWorkspaceSnapshot {
  const workspace = createPluginsWorkspaceStateAccess(serverSocket);
  const catalogState = workspace.getCatalogState();
  const installState = workspace.getInstallState();
  const requiredIds = readRequiredPluginIdsSnapshot(serverSocket, declaredRequiredPluginIds);
  return {
    catalog: freezeArrayCopy(catalogState.catalog),
    catalogById: freezeRecordCopy(catalogState.catalogById),
    catalogLoading: catalogState.catalogLoading,
    catalogError: catalogState.catalogError,
    installedById: freezeRecordCopy(installState.installedById),
    progressById: freezeRecordCopy(installState.progressById),
    busyPluginIds: freezeArrayCopy(installState.busyPluginIds),
    missingRequiredIds: freezeArrayCopy(installState.missingRequiredIds),
    requiredIds: freezeArrayCopy(requiredIds),
  };
}

export function createPluginsWorkspaceCapabilities(
  args: PluginsWorkspaceCapabilitiesArgs,
): PluginsWorkspaceCapabilities {
  function readServerSocket(): string {
    return String(args.getServerSocket() ?? "").trim();
  }

  function readRequiredIds(inputRequiredIds?: readonly string[]): string[] {
    if (inputRequiredIds) return normalizeRequiredPluginIds(inputRequiredIds);
    return readRequiredPluginIdsSnapshot(readServerSocket(), args.getRequiredPluginIds());
  }

  async function refreshCatalog(): Promise<void> {
    await createPluginsWorkspaceStateAccess(readServerSocket()).refreshCatalog();
  }

  async function refreshInstalled(): Promise<void> {
    await createPluginsWorkspaceStateAccess(readServerSocket()).refreshInstalled();
  }

  function recheckRequired(inputRequiredIds?: readonly string[]): void {
    createPluginsWorkspaceStateAccess(readServerSocket()).recheckRequired(readRequiredIds(inputRequiredIds));
  }

  async function refreshInstalledAndRecheck(inputRequiredIds?: readonly string[]): Promise<void> {
    await refreshInstalled();
    recheckRequired(inputRequiredIds);
  }

  return {
    getSnapshot(): PluginsWorkspaceSnapshot {
      const serverSocket = readServerSocket();
      return getPluginsWorkspaceSnapshot(serverSocket, args.getRequiredPluginIds());
    },
    refreshCatalog,
    refreshInstalled,
    refreshInstalledAndRecheck,
    recheckRequired,
    install(plugin: PluginCatalogEntryLike, version: string) {
      return createPluginsWorkspaceStateAccess(readServerSocket()).install(plugin, version);
    },
    updateToLatest(plugin: PluginCatalogEntryLike, latestVersion: string) {
      return createPluginsWorkspaceStateAccess(readServerSocket()).updateToLatest(plugin, latestVersion);
    },
    switchVersion(pluginId: string, version: string) {
      return createPluginsWorkspaceStateAccess(readServerSocket()).switchVersion(pluginId, version);
    },
    rollback(pluginId: string) {
      return createPluginsWorkspaceStateAccess(readServerSocket()).rollback(pluginId);
    },
    enable(pluginId: string) {
      return createPluginsWorkspaceStateAccess(readServerSocket()).enable(pluginId);
    },
    disable(pluginId: string) {
      return createPluginsWorkspaceStateAccess(readServerSocket()).disable(pluginId);
    },
    uninstall(pluginId: string) {
      return createPluginsWorkspaceStateAccess(readServerSocket()).uninstall(pluginId);
    },
    isInstalled(pluginId: string) {
      return createPluginsWorkspaceStateAccess(readServerSocket()).isInstalled(pluginId);
    },
    isEnabled(pluginId: string) {
      return createPluginsWorkspaceStateAccess(readServerSocket()).isEnabled(pluginId);
    },
    isFailed(pluginId: string) {
      return createPluginsWorkspaceStateAccess(readServerSocket()).isFailed(pluginId);
    },
  };
}

export async function refreshDomainCatalog(serverSocket: string): Promise<void> {
  const socket = String(serverSocket ?? "").trim();
  await createPluginsWorkspaceStateAccess(socket).refreshDomainCatalog();
}

export function listInstalledPlugins(serverSocket: string): Promise<InstalledPluginState[]> {
  return getListInstalledPluginsUsecase().execute(serverSocket);
}
