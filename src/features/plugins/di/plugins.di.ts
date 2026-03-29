/**
 * @fileoverview plugins.di.ts
 * @description plugins｜依赖组装（DI）：plugins.di。
 */

import { selectByMockMode } from "@/shared/config/mockModeSelector";
import {
  mockPluginInstallQueryAdapter,
  mockPluginLifecycleCommandAdapter,
} from "@/features/plugins/mock/mockPluginManager";
import {
  tauriPluginInstallQueryAdapter,
  tauriPluginLifecycleCommandAdapter,
} from "@/features/plugins/data/tauriPluginManager";
import type { PluginInstallQueryPort } from "../domain/ports/PluginInstallQueryPort";
import type { PluginLifecycleCommandPort } from "../domain/ports/PluginLifecycleCommandPort";
import type { PluginCatalogPort } from "../domain/ports/PluginCatalogPort";
import type { RepoPluginCatalogPort } from "../domain/ports/RepoPluginCatalogPort";
import type { DomainCatalogPort } from "../domain/ports/DomainCatalogPort";
import type {
  PluginsRuntimeLifecycleAccess,
  PluginsRuntimeStateAccess,
  PluginsWorkspaceStateAccess,
} from "../contracts/featureStateAccess";
import { httpServerPluginCatalogPort } from "../data/httpPluginCatalog";
import { mockPluginCatalogPort } from "../mock/mockPluginCatalogPort";
import { httpRepoPluginCatalogPort } from "../data/httpRepoPluginCatalog";
import { httpDomainCatalogPort } from "../data/httpDomainCatalog";
import {
  createPluginsRuntimeLifecycleAccess as createPluginsRuntimeLifecycleAccessAdapter,
  createPluginsRuntimeStateAccess as createPluginsRuntimeStateAccessAdapter,
  createPluginsWorkspaceStateAccess as createPluginsWorkspaceStateAccessAdapter,
} from "../presentation/store/featureStateAccess";

// 用例
import { ListPluginCatalog } from "../domain/usecases/ListPluginCatalog";
import { ListInstalledPlugins } from "../domain/usecases/ListInstalledPlugins";
import { GetInstalledPluginState } from "../domain/usecases/GetInstalledPluginState";
import { InstallPlugin } from "../domain/usecases/InstallPlugin";
import { SwitchPluginVersion } from "../domain/usecases/SwitchPluginVersion";
import { EnablePlugin } from "../domain/usecases/EnablePlugin";
import { ApplyPluginRuntimeOps } from "../domain/usecases/ApplyPluginRuntimeOps";

let pluginInstallQueryPort: PluginInstallQueryPort | null = null;
let pluginLifecycleCommandPort: PluginLifecycleCommandPort | null = null;
let pluginCatalogPort: PluginCatalogPort | null = null;
let repoCatalogPort: RepoPluginCatalogPort | null = null;
let domainCatalogPort: DomainCatalogPort | null = null;
let pluginsRuntimeLifecycleAccess: PluginsRuntimeLifecycleAccess | null = null;

// ============================================================================
// Ports
// ============================================================================

/**
 * 获取插件安装态查询端口（单例）。
 *
 * @returns `PluginInstallQueryPort` 实例。
 */
export function getPluginInstallQueryPort(): PluginInstallQueryPort {
  if (pluginInstallQueryPort) return pluginInstallQueryPort;
  pluginInstallQueryPort = selectByMockMode<PluginInstallQueryPort>({
    off: () => tauriPluginInstallQueryAdapter,
    store: () => mockPluginInstallQueryAdapter,
    protocol: () => mockPluginInstallQueryAdapter,
  });
  return pluginInstallQueryPort;
}

/**
 * 获取插件生命周期命令端口（单例）。
 *
 * @returns `PluginLifecycleCommandPort` 实例。
 */
export function getPluginLifecycleCommandPort(): PluginLifecycleCommandPort {
  if (pluginLifecycleCommandPort) return pluginLifecycleCommandPort;
  pluginLifecycleCommandPort = selectByMockMode<PluginLifecycleCommandPort>({
    off: () => tauriPluginLifecycleCommandAdapter,
    store: () => mockPluginLifecycleCommandAdapter,
    protocol: () => mockPluginLifecycleCommandAdapter,
  });
  return pluginLifecycleCommandPort;
}

/**
 * 获取插件目录查询端口（单例）。
 *
 * 说明：
 * - 用于承载 catalog 的只读查询能力，避免与命令端口耦合；
 * - `store` mock 模式使用独立 mock catalog 端口。
 *
 * @returns `PluginCatalogPort` 实例。
 */
export function getPluginCatalogPort(): PluginCatalogPort {
  if (pluginCatalogPort) return pluginCatalogPort;
  pluginCatalogPort = selectByMockMode<PluginCatalogPort>({
    off: () => httpServerPluginCatalogPort,
    protocol: () => httpServerPluginCatalogPort,
    store: () => mockPluginCatalogPort,
  });
  return pluginCatalogPort;
}

/**
 * 获取 repo catalog port（单例）。
 *
 * @returns RepoPluginCatalogPort 实例。
 */
export function getRepoPluginCatalogPort(): RepoPluginCatalogPort {
  if (repoCatalogPort) return repoCatalogPort;
  // repo catalog 当前仅提供 HTTP fetch 实现；mock 模式下也允许请求（用于本地测试）。
  repoCatalogPort = httpRepoPluginCatalogPort;
  return repoCatalogPort;
}

/**
 * 获取 domain catalog port（单例）。
 *
 * @returns DomainCatalogPort 实例。
 */
export function getDomainCatalogPort(): DomainCatalogPort {
  if (domainCatalogPort) return domainCatalogPort;
  domainCatalogPort = httpDomainCatalogPort;
  return domainCatalogPort;
}

/**
 * 获取 plugins feature runtime 生命周期访问契约。
 *
 * @returns runtime 生命周期访问器。
 */
export function getPluginsRuntimeLifecycleAccess(): PluginsRuntimeLifecycleAccess {
  if (pluginsRuntimeLifecycleAccess) return pluginsRuntimeLifecycleAccess;
  pluginsRuntimeLifecycleAccess = createPluginsRuntimeLifecycleAccessAdapter();
  return pluginsRuntimeLifecycleAccess;
}

/**
 * 创建某个 server 作用域下的 workspace 状态访问器。
 *
 * @param serverSocket - 目标 server socket。
 * @returns workspace 状态访问器。
 */
export function createPluginsWorkspaceStateAccess(serverSocket: string): PluginsWorkspaceStateAccess {
  return createPluginsWorkspaceStateAccessAdapter(serverSocket);
}

/**
 * 创建某个 server 作用域下的 runtime 状态访问器。
 *
 * @param serverSocket - 目标 server socket。
 * @returns runtime 状态访问器。
 */
export function createPluginsRuntimeStateAccess(serverSocket: string): PluginsRuntimeStateAccess {
  return createPluginsRuntimeStateAccessAdapter(serverSocket);
}

// ============================================================================
// 用例
// ============================================================================

/**
 * 获取 `ListPluginCatalog` 用例实例。
 *
 * @returns `ListPluginCatalog` 实例。
 */
export function getListPluginCatalogUsecase(): ListPluginCatalog {
  return new ListPluginCatalog(getPluginCatalogPort());
}

/**
 * 获取 `ListInstalledPlugins` 用例实例。
 *
 * @returns `ListInstalledPlugins` 实例。
 */
export function getListInstalledPluginsUsecase(): ListInstalledPlugins {
  return new ListInstalledPlugins(getPluginInstallQueryPort());
}

/**
 * 获取 `GetInstalledPluginState` 用例实例。
 *
 * @returns `GetInstalledPluginState` 实例。
 */
export function getGetInstalledPluginStateUsecase(): GetInstalledPluginState {
  return new GetInstalledPluginState(getPluginInstallQueryPort());
}

/**
 * 获取 `InstallPlugin` 用例实例。
 *
 * @returns `InstallPlugin` 实例。
 */
export function getInstallPluginUsecase(): InstallPlugin {
  return new InstallPlugin(getPluginLifecycleCommandPort());
}

/**
 * 获取 `SwitchPluginVersion` 用例实例。
 *
 * @returns `SwitchPluginVersion` 实例。
 */
export function getSwitchPluginVersionUsecase(): SwitchPluginVersion {
  return new SwitchPluginVersion(getPluginLifecycleCommandPort());
}

/**
 * 获取 `EnablePlugin` 用例实例。
 *
 * @returns `EnablePlugin` 实例。
 */
export function getEnablePluginUsecase(): EnablePlugin {
  return new EnablePlugin(getPluginLifecycleCommandPort());
}

/**
 * 获取 `ApplyPluginRuntimeOps` 用例实例。
 *
 * @param runtime - 插件运行时操作端口。
 * @returns `ApplyPluginRuntimeOps` 实例。
 */
export function getApplyPluginRuntimeOpsUsecase(
  runtime: ConstructorParameters<typeof ApplyPluginRuntimeOps>[1],
): ApplyPluginRuntimeOps {
  return new ApplyPluginRuntimeOps(getPluginLifecycleCommandPort(), runtime);
}
