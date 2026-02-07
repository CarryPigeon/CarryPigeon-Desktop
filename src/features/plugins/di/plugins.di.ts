/**
 * @fileoverview plugins.di.ts
 * @description plugins｜依赖组装（DI）：plugins.di。
 */

import { selectByMockMode } from "@/shared/config/mockModeSelector";
import { mockPluginManager } from "@/features/plugins/mock/mockPluginManager";
import { hybridPluginManager } from "@/features/plugins/data/hybridPluginManager";
import { protocolMockPluginManager } from "@/features/plugins/data/protocolMockPluginManager";
import type { PluginManagerPort } from "../domain/ports/PluginManagerPort";
import type { RepoPluginCatalogPort } from "../domain/ports/RepoPluginCatalogPort";
import type { DomainCatalogPort } from "../domain/ports/DomainCatalogPort";
import { repoPluginCatalogPort } from "../data/repoPluginCatalogPort";
import { domainCatalogPort } from "../data/domainCatalogPort";

// 用例
import { ListPluginCatalog } from "../domain/usecases/ListPluginCatalog";
import { ListInstalledPlugins } from "../domain/usecases/ListInstalledPlugins";
import { GetInstalledPluginState } from "../domain/usecases/GetInstalledPluginState";
import { InstallPlugin } from "../domain/usecases/InstallPlugin";
import { SwitchPluginVersion } from "../domain/usecases/SwitchPluginVersion";
import { EnablePlugin } from "../domain/usecases/EnablePlugin";
import { DisablePlugin } from "../domain/usecases/DisablePlugin";
import { UninstallPlugin } from "../domain/usecases/UninstallPlugin";
import { ApplyPluginRuntimeOps } from "../domain/usecases/ApplyPluginRuntimeOps";

let pluginManager: PluginManagerPort | null = null;
let repoCatalog: RepoPluginCatalogPort | null = null;
let domainCatalog: DomainCatalogPort | null = null;

// ============================================================================
// Ports
// ============================================================================

/**
 * 获取单例 `PluginManagerPort`。
 *
 * 选择规则：
 * - `USE_MOCK_TRANSPORT=true`：使用协议层 mock（模拟端到端协议但不依赖真实服务端）。
 * - `IS_STORE_MOCK=true`：使用内存 mock（用于 UI 预览/开发联调）。
 * - 其它情况：使用混合实现（通常为真实数据源）。
 *
 * @returns `PluginManagerPort` 实例。
 */
export function getPluginManagerPort(): PluginManagerPort {
  if (pluginManager) return pluginManager;
  pluginManager = selectByMockMode<PluginManagerPort>({
    off: () => hybridPluginManager,
    store: () => mockPluginManager,
    protocol: () => protocolMockPluginManager,
  });
  return pluginManager;
}

/**
 * 获取 repo catalog port（单例）。
 *
 * @returns RepoPluginCatalogPort 实例。
 */
export function getRepoPluginCatalogPort(): RepoPluginCatalogPort {
  if (repoCatalog) return repoCatalog;
  // repo catalog 当前仅提供 HTTP fetch 实现；mock 模式下也允许请求（用于本地测试）。
  repoCatalog = repoPluginCatalogPort;
  return repoCatalog;
}

/**
 * 获取 domain catalog port（单例）。
 *
 * @returns DomainCatalogPort 实例。
 */
export function getDomainCatalogPort(): DomainCatalogPort {
  if (domainCatalog) return domainCatalog;
  domainCatalog = domainCatalogPort;
  return domainCatalog;
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
  return new ListPluginCatalog(getPluginManagerPort());
}

/**
 * 获取 `ListInstalledPlugins` 用例实例。
 *
 * @returns `ListInstalledPlugins` 实例。
 */
export function getListInstalledPluginsUsecase(): ListInstalledPlugins {
  return new ListInstalledPlugins(getPluginManagerPort());
}

/**
 * 获取 `GetInstalledPluginState` 用例实例。
 *
 * @returns `GetInstalledPluginState` 实例。
 */
export function getGetInstalledPluginStateUsecase(): GetInstalledPluginState {
  return new GetInstalledPluginState(getPluginManagerPort());
}

/**
 * 获取 `InstallPlugin` 用例实例。
 *
 * @returns `InstallPlugin` 实例。
 */
export function getInstallPluginUsecase(): InstallPlugin {
  return new InstallPlugin(getPluginManagerPort());
}

/**
 * 获取 `SwitchPluginVersion` 用例实例。
 *
 * @returns `SwitchPluginVersion` 实例。
 */
export function getSwitchPluginVersionUsecase(): SwitchPluginVersion {
  return new SwitchPluginVersion(getPluginManagerPort());
}

/**
 * 获取 `EnablePlugin` 用例实例。
 *
 * @returns `EnablePlugin` 实例。
 */
export function getEnablePluginUsecase(): EnablePlugin {
  return new EnablePlugin(getPluginManagerPort());
}

/**
 * 获取 `DisablePlugin` 用例实例。
 *
 * @returns `DisablePlugin` 实例。
 */
export function getDisablePluginUsecase(): DisablePlugin {
  return new DisablePlugin(getPluginManagerPort());
}

/**
 * 获取 `UninstallPlugin` 用例实例。
 *
 * @returns `UninstallPlugin` 实例。
 */
export function getUninstallPluginUsecase(): UninstallPlugin {
  return new UninstallPlugin(getPluginManagerPort());
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
  return new ApplyPluginRuntimeOps(getPluginManagerPort(), runtime);
}
