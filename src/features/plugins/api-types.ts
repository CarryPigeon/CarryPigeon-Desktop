/**
 * @fileoverview plugins Feature 公共类型出口。
 * @description
 * 仅导出 plugins 对外稳定可见的公共类型，避免把内部 store / runtime 实现细节暴露为公共 API。
 */

import type { DomainBinding, DomainRegistryHostBridge } from "./contracts/domainRegistry";
import type { PluginComposerPayload, PluginContext } from "./domain/types/pluginRuntimeTypes";
import type {
  InstalledPluginState,
  PluginCatalogEntryLike,
  PluginProgress,
} from "./domain/types/pluginTypes";
import type {
  DisablePluginOutcome,
  EnablePluginOutcome,
  InstallPluginOutcome,
  RollbackPluginOutcome,
  SwitchPluginVersionOutcome,
  UninstallPluginOutcome,
  UpdatePluginToLatestOutcome,
} from "./application/pluginCommandOutcome";

export type { DomainRegistryHostBridge, PluginComposerPayload, PluginContext };
export type {
  PluginCatalogEntryLike,
};
export type {
  DisablePluginOutcome,
  EnablePluginOutcome,
  InstallPluginOutcome,
  PluginCommandErrorCode,
  PluginCommandErrorInfo,
  PluginLifecycleCommandOutcome,
  RollbackPluginOutcome,
  SwitchPluginVersionOutcome,
  UninstallPluginOutcome,
  UpdatePluginToLatestOutcome,
} from "./application/pluginCommandOutcome";

/**
 * plugins runtime lease。
 */
export type PluginsRuntimeLease = {
  /**
   * 释放当前运行时 lease。
   *
   * @returns 释放完成后 resolve。
   */
  release(): Promise<void>;
};

/**
 * 跨 feature 可消费的插件工作区快照。
 *
 * 说明：
 * - 该快照是 plain data 视图；
 * - 调用方应将其视为“只读状态投影”，而不是内部 store 本体。
 */
export type PluginsWorkspaceSnapshot = {
  /**
   * 当前 catalog 列表快照。
   */
  catalog: readonly PluginCatalogEntryLike[];

  /**
   * 按插件 id 建立的 catalog 索引。
   */
  catalogById: Record<string, PluginCatalogEntryLike>;

  /**
   * catalog 是否正在加载。
   */
  catalogLoading: boolean;

  /**
   * catalog 加载失败时的错误文案；空字符串表示无错误。
   */
  catalogError: string;

  /**
   * 已安装插件状态表，按插件 id 建立索引。
   */
  installedById: Record<string, InstalledPluginState>;

  /**
   * 当前插件任务进度表，按插件 id 建立索引。
   */
  progressById: Record<string, PluginProgress | null>;

  /**
   * 当前处于忙碌状态的插件 id 集合。
   */
  busyPluginIds: readonly string[];

  /**
   * 当前仍缺失的 required plugin id 列表。
   */
  missingRequiredIds: readonly string[];

  /**
   * 当前 server 声明要求的 required plugin id 列表。
   */
  requiredIds: readonly string[];
};

/**
 * 跨 feature 可消费的插件工作区 capability 入参。
 */
export type PluginsWorkspaceCapabilitiesArgs = {
  /**
   * 返回当前 server socket。
   *
   * @returns 当前 server socket；缺失时返回空字符串。
   */
  getServerSocket(): string;

  /**
   * 返回当前 server 声明要求的 required plugin id 列表。
   *
   * @returns required plugin id 列表；未知时返回 `null`。
   */
  getRequiredPluginIds(): readonly string[] | null;
};

/**
 * 跨 feature 可消费的插件工作区 capability。
 *
 * 说明：
 * - 该 capability 是 plugins feature 为页面/流程编排暴露的局部能力对象；
 * - 负责 catalog、installed、required-gate 与安装生命周期动作。
 */
export type PluginsWorkspaceCapabilities = {
  /**
   * 读取当前工作区快照。
   *
   * @returns 当前插件工作区快照。
   */
  getSnapshot(): PluginsWorkspaceSnapshot;

  /**
   * 刷新插件 catalog。
   *
   * @returns 刷新完成后 resolve。
   */
  refreshCatalog(): Promise<void>;

  /**
   * 刷新已安装插件状态。
   *
   * @returns 刷新完成后 resolve。
   */
  refreshInstalled(): Promise<void>;

  /**
   * 同时刷新已安装状态并重新判定 required plugin 缺口。
   *
   * @param requiredIds - 可选的 required plugin id 列表；缺省时由控制器当前上下文决定。
   * @returns 刷新与重判完成后 resolve。
   */
  refreshInstalledAndRecheck(requiredIds?: readonly string[]): Promise<void>;

  /**
   * 重新判定 required plugin 缺口，但不主动刷新远端状态。
   *
   * @param requiredIds - 可选的 required plugin id 列表；缺省时由控制器当前上下文决定。
   * @returns 无返回值。
   */
  recheckRequired(requiredIds?: readonly string[]): void;

  /**
   * 安装指定插件版本。
   *
   * @param plugin - 目标插件 catalog 条目。
   * @param version - 目标版本号。
   * @returns 显式安装结果；失败时返回结构化错误信息。
   */
  install(plugin: PluginCatalogEntryLike, version: string): Promise<InstallPluginOutcome>;

  /**
   * 将插件升级到指定“最新版本”。
   *
   * @param plugin - 目标插件 catalog 条目。
   * @param latestVersion - 已由调用方解析出的目标最新版本。
   * @returns 显式更新结果；失败时返回结构化错误信息。
   */
  updateToLatest(plugin: PluginCatalogEntryLike, latestVersion: string): Promise<UpdatePluginToLatestOutcome>;

  /**
   * 切换插件到指定版本。
   *
   * @param pluginId - 目标插件 id。
   * @param version - 目标版本号。
   * @returns 显式切换结果；失败时返回结构化错误信息。
   */
  switchVersion(pluginId: string, version: string): Promise<SwitchPluginVersionOutcome>;

  /**
   * 回滚插件到上一可用版本。
   *
   * @param pluginId - 目标插件 id。
   * @returns 显式回滚结果；失败时返回结构化错误信息。
   */
  rollback(pluginId: string): Promise<RollbackPluginOutcome>;

  /**
   * 启用指定插件。
   *
   * @param pluginId - 目标插件 id。
   * @returns 显式启用结果；失败时返回结构化错误信息。
   */
  enable(pluginId: string): Promise<EnablePluginOutcome>;

  /**
   * 停用指定插件。
   *
   * @param pluginId - 目标插件 id。
   * @returns 显式停用结果；失败时返回结构化错误信息。
   */
  disable(pluginId: string): Promise<DisablePluginOutcome>;

  /**
   * 卸载指定插件。
   *
   * @param pluginId - 目标插件 id。
   * @returns 显式卸载结果；失败时返回结构化错误信息。
   */
  uninstall(pluginId: string): Promise<UninstallPluginOutcome>;

  /**
   * 判断插件是否已安装。
   *
   * @param pluginId - 目标插件 id。
   * @returns 已安装时为 `true`。
   */
  isInstalled(pluginId: string): boolean;

  /**
   * 判断插件是否已启用。
   *
   * @param pluginId - 目标插件 id。
   * @returns 已启用时为 `true`。
   */
  isEnabled(pluginId: string): boolean;

  /**
   * 判断插件当前是否处于失败态。
   *
   * @param pluginId - 目标插件 id。
   * @returns 失败时为 `true`。
   */
  isFailed(pluginId: string): boolean;
};

/**
 * 供 chat composer 消费的可用消息 domain 条目。
 */
export type AvailablePluginMessageDomain = {
  /**
   * domain 稳定标识。
   */
  id: string;

  /**
   * 用于 UI 展示的 domain 标签。
   */
  label: string;

  /**
   * UI 中使用的 domain 色彩变量名。
   */
  colorVar:
    | "--cp-domain-core"
    | "--cp-domain-ext-a"
    | "--cp-domain-ext-b"
    | "--cp-domain-ext-c"
    | "--cp-domain-unknown";

  /**
   * 与该 domain 关联的插件 id 提示，可选。
   */
  pluginIdHint?: string;

  /**
   * 当前 domain 绑定的插件版本，可选。
   */
  version?: string;
};

/**
 * 插件运行时只读查询 capability。
 */
export type PluginRuntimeCapabilities = {
  /**
   * 按消息 domain 查询运行时 binding。
   *
   * @param domain - 消息 domain 标识。
   * @returns 找到时返回 binding；否则返回 `null`。
   */
  getBinding(domain: string): DomainBinding | null;

  /**
   * 按插件 id 查询运行时上下文。
   *
   * @param pluginId - 插件 id。
   * @returns 找到时返回运行时上下文；否则返回 `null`。
   */
  getContextForPlugin(pluginId: string): PluginContext | null;

  /**
   * 按消息 domain 查询所属插件运行时上下文。
   *
   * @param domain - 消息 domain 标识。
   * @returns 找到时返回运行时上下文；否则返回 `null`。
   */
  getContextForDomain(domain: string): PluginContext | null;
};

/**
 * plugins feature 跨 feature 公共能力面（object-capability）。
 *
 * 说明：
 * - 调用方应优先通过 `createPluginsCapabilities` / `getPluginsCapabilities` 获取能力对象；
 * - 该契约只描述稳定公共能力，不包含内部 store/composable/runtime 组织细节。
 */
export type PluginsCapabilities = {
  /**
   * 插件工作区能力。
   */
  workspace: {
    /**
     * 为某个 server 工作区创建插件工作区 capability。
     *
     * @param args - 当前 server 工作区相关的上下文访问器。
     * @returns 局部插件工作区 capability。
     */
    createCapabilities(args: PluginsWorkspaceCapabilitiesArgs): PluginsWorkspaceCapabilities;
  };

  /**
   * 插件 catalog 辅助能力。
   */
  catalog: {
    /**
     * 从 catalog 条目中解析“应被视为最新”的版本号。
     *
     * @param plugin - 目标插件 catalog 条目。
     * @returns 最新版本号；无法解析时返回空字符串。
     */
    resolveLatestVersion(plugin: PluginCatalogEntryLike): string;
  };

  /**
   * plugins feature 运行时能力。
   */
  runtime: {
    /**
     * 获取一个 plugins runtime lease。
     *
     * 约定：
     * - 多个调用方共享同一个底层 runtime；
     * - 只有最后一个 lease 释放后，底层 runtime 才允许停止。
     *
     * @returns 运行时 lease。
     */
    acquireLease(): Promise<PluginsRuntimeLease>;
  };

  /**
   * @param serverSocket - 目标服务器 socket。
   * @returns 绑定到该 server 的局部能力对象。
   */
  forServer(serverSocket: string): {
    /**
     * 列出指定 server 下的已安装插件状态。
     *
     * @returns 已安装插件状态列表。
     */
    listInstalledPlugins(): Promise<InstalledPluginState[]>;

    /**
     * 刷新指定 server 的 domain catalog。
     *
     * @returns 刷新完成后 resolve。
     */
    refreshDomainCatalog(): Promise<void>;

    /**
     * 确保指定 server 的插件运行时已完成加载。
     *
     * @returns 运行时可用后 resolve。
     */
    ensureRuntimeLoaded(): Promise<void>;

    /**
     * 获取指定 server 的插件运行时只读查询 capability。
     *
     * @returns 插件运行时只读 capability。
     */
    getRuntimeCapabilities(): PluginRuntimeCapabilities;

    /**
     * 为指定 server 绑定 domain registry host bridge。
     *
     * @param bridge - 要挂载的 host bridge。
     * @returns 无返回值。
     */
    attachHostBridge(bridge: DomainRegistryHostBridge): void;

    /**
     * 解除指定 server 上已挂载的 host bridge。
     *
     * @returns 无返回值。
     */
    detachHostBridge(): void;

    /**
     * 列出指定 server 当前可用于 chat composer 的消息 domain。
     *
     * @returns 可用消息 domain 列表。
     */
    getAvailableMessageDomains(): AvailablePluginMessageDomain[];

    /**
     * 解析某个消息 domain 对应的插件 id 提示。
     *
     * @param domain - 消息 domain 标识。
     * @returns 插件 id 提示；无法解析时返回空字符串。
     */
    resolveDomainPluginHint(domain: string): string;
  };
};
