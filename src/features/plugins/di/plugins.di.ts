/**
 * @fileoverview plugins.di.ts
 * @description Composition root for plugins feature.
 */

import { USE_MOCK_API, USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { mockPluginManager } from "@/features/plugins/mock/mockPluginManager";
import { hybridPluginManager } from "@/features/plugins/data/hybridPluginManager";
import { protocolMockPluginManager } from "@/features/plugins/data/protocolMockPluginManager";
import type { PluginManagerPort } from "../domain/ports/PluginManagerPort";

// Usecases
import { ListPluginCatalog } from "../domain/usecases/ListPluginCatalog";
import { ListInstalledPlugins } from "../domain/usecases/ListInstalledPlugins";
import { GetInstalledPluginState } from "../domain/usecases/GetInstalledPluginState";
import { InstallPlugin } from "../domain/usecases/InstallPlugin";
import { SwitchPluginVersion } from "../domain/usecases/SwitchPluginVersion";
import { EnablePlugin } from "../domain/usecases/EnablePlugin";
import { DisablePlugin } from "../domain/usecases/DisablePlugin";
import { UninstallPlugin } from "../domain/usecases/UninstallPlugin";

let pluginManager: PluginManagerPort | null = null;

// ============================================================================
// Ports
// ============================================================================

/**
 * Get a singleton `PluginManagerPort`.
 *
 * Uses mock implementation when `USE_MOCK_API=true`.
 *
 * @returns Port instance.
 */
export function getPluginManagerPort(): PluginManagerPort {
  if (pluginManager) return pluginManager;
  pluginManager = USE_MOCK_TRANSPORT ? protocolMockPluginManager : USE_MOCK_API ? mockPluginManager : hybridPluginManager;
  return pluginManager;
}

// ============================================================================
// Usecases
// ============================================================================

/**
 * Get ListPluginCatalog usecase.
 *
 * @returns ListPluginCatalog usecase instance.
 */
export function getListPluginCatalogUsecase(): ListPluginCatalog {
  return new ListPluginCatalog(getPluginManagerPort());
}

/**
 * Get ListInstalledPlugins usecase.
 *
 * @returns ListInstalledPlugins usecase instance.
 */
export function getListInstalledPluginsUsecase(): ListInstalledPlugins {
  return new ListInstalledPlugins(getPluginManagerPort());
}

/**
 * Get GetInstalledPluginState usecase.
 *
 * @returns GetInstalledPluginState usecase instance.
 */
export function getGetInstalledPluginStateUsecase(): GetInstalledPluginState {
  return new GetInstalledPluginState(getPluginManagerPort());
}

/**
 * Get InstallPlugin usecase.
 *
 * @returns InstallPlugin usecase instance.
 */
export function getInstallPluginUsecase(): InstallPlugin {
  return new InstallPlugin(getPluginManagerPort());
}

/**
 * Get SwitchPluginVersion usecase.
 *
 * @returns SwitchPluginVersion usecase instance.
 */
export function getSwitchPluginVersionUsecase(): SwitchPluginVersion {
  return new SwitchPluginVersion(getPluginManagerPort());
}

/**
 * Get EnablePlugin usecase.
 *
 * @returns EnablePlugin usecase instance.
 */
export function getEnablePluginUsecase(): EnablePlugin {
  return new EnablePlugin(getPluginManagerPort());
}

/**
 * Get DisablePlugin usecase.
 *
 * @returns DisablePlugin usecase instance.
 */
export function getDisablePluginUsecase(): DisablePlugin {
  return new DisablePlugin(getPluginManagerPort());
}

/**
 * Get UninstallPlugin usecase.
 *
 * @returns UninstallPlugin usecase instance.
 */
export function getUninstallPluginUsecase(): UninstallPlugin {
  return new UninstallPlugin(getPluginManagerPort());
}
