/**
 * @fileoverview pluginInstallStore.ts
 * @description plugins｜展示层状态（store）：pluginInstallStore。
 *
 * 职责（展示层）：
 * - 跟踪某个服务端上下文下已安装插件及其启用状态。
 * - 跟踪进行中的操作进度（install/enable/update/switch/rollback），供 UI 展示。
 * - 提供便捷判断（`isInstalled`/`isEnabled`/`isFailed`）。
 *
 * 分层说明（Clean Architecture）：
 * 本 store 通过 DI 获取 Query/Command 端口与领域层交互，从而在不修改 UI 的前提下
 * 切换不同实现（mock / Tauri commands）。
 */

import { computed, reactive, ref, type Ref } from "vue";
import {
  getApplyPluginRuntimeOpsUsecase,
  getPluginInstallQueryPort,
  getPluginLifecycleCommandPort,
} from "@/features/plugins/di/plugins.di";
import {
  type PluginCatalogEntryLike,
  type InstalledPluginState,
  type PluginProgress,
} from "@/features/plugins/domain/types/pluginTypes";
import type {
  DisablePluginOutcome,
  EnablePluginOutcome,
  InstallPluginOutcome,
  PluginCommandErrorCode,
  PluginCommandErrorInfo,
  RollbackPluginOutcome,
  SwitchPluginVersionOutcome,
  UninstallPluginOutcome,
  UpdatePluginToLatestOutcome,
} from "@/features/plugins/application/pluginCommandOutcome";
import { toPluginCommandErrorInfo } from "@/features/plugins/application/pluginCommandOutcome";
import { createLogger } from "@/shared/utils/logger";
import { IS_STORE_MOCK, USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { NO_SERVER_KEY, normalizeServerKey } from "@/shared/serverKey";
import type { PluginRuntimeOpsPort } from "@/features/plugins/domain/usecases/ApplyPluginRuntimeOps";
import { registerServerScopeCleanupHandler } from "@/shared/utils/serverScopeLifecycle";
import { createPluginOperationHelpers } from "./pluginInstallOperationHelpers";
import { createPluginInstallActions } from "./pluginInstallActions";
import { createPluginInstallSelectors } from "./pluginInstallSelectors";
import { usePluginRuntimeAccess } from "./pluginRuntimeAccess";
import { registerPluginRuntimeStateSyncListener } from "./pluginRuntimeStateSync";

type InstallStore = {
  installedById: Record<string, InstalledPluginState>;
  progressById: Record<string, PluginProgress | null>;
  busyIds: Readonly<Ref<Set<string>>>;
  missingRequiredIds: Readonly<Ref<string[]>>;
  refreshInstalled(): Promise<void>;
  install(plugin: PluginCatalogEntryLike, version: string): Promise<InstallPluginOutcome>;
  updateToLatest(plugin: PluginCatalogEntryLike, latestVersion: string): Promise<UpdatePluginToLatestOutcome>;
  switchVersion(pluginId: string, version: string): Promise<SwitchPluginVersionOutcome>;
  rollback(pluginId: string): Promise<RollbackPluginOutcome>;
  enable(pluginId: string): Promise<EnablePluginOutcome>;
  disable(pluginId: string): Promise<DisablePluginOutcome>;
  uninstall(pluginId: string): Promise<UninstallPluginOutcome>;
  recheckRequired(requiredIds: string[]): void;
  isInstalled(pluginId: string): boolean;
  isEnabled(pluginId: string): boolean;
  isFailed(pluginId: string): boolean;
};

const logger = createLogger("pluginInstallStore");
const stores = new Map<string, InstallStore>();
const runtimeSyncUnsubscribeByKey = new Map<string, () => void>();
let runtimeStarted = false;
let stopRuntimeCleanup: (() => void) | null = null;

/**
 * 启动 plugin-install 运行时（幂等）。
 *
 * 说明：
 * - 显式注册 server-scope 清理回调；
 * - 避免模块加载时产生副作用。
 */
export function startPluginInstallRuntime(): void {
  if (runtimeStarted) return;
  runtimeStarted = true;
  stopRuntimeCleanup = registerServerScopeCleanupHandler((event) => {
    if (event.type === "all") {
      for (const unsubscribe of runtimeSyncUnsubscribeByKey.values()) unsubscribe();
      runtimeSyncUnsubscribeByKey.clear();
      stores.clear();
      return;
    }
    runtimeSyncUnsubscribeByKey.get(event.key)?.();
    runtimeSyncUnsubscribeByKey.delete(event.key);
    stores.delete(event.key);
  });
}

/**
 * 停止 plugin-install 运行时（best-effort）。
 */
export function stopPluginInstallRuntime(): void {
  if (!runtimeStarted) return;
  runtimeStarted = false;
  stopRuntimeCleanup?.();
  stopRuntimeCleanup = null;
  for (const unsubscribe of runtimeSyncUnsubscribeByKey.values()) unsubscribe();
  runtimeSyncUnsubscribeByKey.clear();
  stores.clear();
}

/**
 * 获取（或创建）某个服务端上下文对应的安装状态 store。
 *
 * - 以 `serverSocket.trim()` 作为 key。
 * - 空 socket 使用 `NO_SERVER_KEY`，用于 UI 预览态（无真实后端）。
 *
 * @param serverSocket - 当前服务端 socket。
 * @returns 该 socket 对应的稳定 store 实例。
 */
export function usePluginInstallStore(serverSocket: string): InstallStore {
  const key = normalizeServerKey(serverSocket);
  const existing = stores.get(key);
  if (existing) return existing;

  const queryPort = getPluginInstallQueryPort();
  const commandPort = getPluginLifecycleCommandPort();
  const installedById = reactive<Record<string, InstalledPluginState>>({});
  const progressById = reactive<Record<string, PluginProgress | null>>({});
  const busyIdsRef = ref<Set<string>>(new Set());
  const missingRequiredIdsRef = ref<string[]>([]);
  const runtimeSupported = !IS_STORE_MOCK && !USE_MOCK_TRANSPORT && key !== NO_SERVER_KEY;
  const runtimeAccess = runtimeSupported ? usePluginRuntimeAccess(key) : null;
  const runtimeOps: PluginRuntimeOpsPort = {
    supported: runtimeSupported,
    validateVersion(pluginId: string, version: string): Promise<void> {
      return validateRuntimeVersion(pluginId, version);
    },
    reload(pluginId: string): Promise<void> {
      return reloadRuntime(pluginId);
    },
    disable(pluginId: string): Promise<void> {
      return disableRuntime(pluginId);
    },
  };
  const runtimeOpsUsecase = getApplyPluginRuntimeOpsUsecase(runtimeOps);

  /**
   * 失败后尽力回填当前插件安装状态（避免 UI 卡在陈旧态）。
   *
   * @param pluginId - 插件 id。
   * @returns 无返回值。
   */
  async function recoverInstalledState(pluginId: string): Promise<void> {
    const existing = await queryPort.getInstalledState(key, pluginId);
    if (existing) installedById[pluginId] = existing;
  }

  const { createProgressHandler, setFailedProgress, runBusyPluginOperation } = createPluginOperationHelpers({
    key,
    busyIdsRef,
    progressById,
    logger,
    recoverInstalledState,
  });

  /**
   * 校验某个版本是否能被运行时动态加载（import）。
   *
   * @param pluginId - 插件 id。
   * @param version - 需要校验的已安装版本号。
   * @returns 无返回值。
   */
  async function validateRuntimeVersion(pluginId: string, version: string): Promise<void> {
    if (!runtimeAccess) return;
    await runtimeAccess.validateVersion(pluginId, version);
  }

  /**
   * 重新加载插件运行时（disable + enable），用于切换版本/修复加载态。
   *
   * @param pluginId - 插件 id。
   * @returns 无返回值。
   */
  async function reloadRuntime(pluginId: string): Promise<void> {
    if (!runtimeAccess) return;
    await runtimeAccess.reload(pluginId);
  }

  /**
   * 禁用插件运行时（尽力而为）。
   *
   * @param pluginId - 插件 id。
   * @returns 无返回值。
   */
  async function disableRuntime(pluginId: string): Promise<void> {
    if (!runtimeAccess) return;
    await runtimeAccess.disable(pluginId);
  }

  /**
   * 从后端刷新已安装插件列表，并与本地缓存对齐。
   *
   * 行为：
   * - 更新后端列表中存在的 `installedById` 条目；
   * - 删除后端已不存在的条目（避免 UI 显示“幽灵插件”）。
   *
   * @returns 无返回值。
   */
  async function refreshInstalled(): Promise<void> {
    try {
      const list = await queryPort.listInstalled(key);
      const installedIds = new Set<string>();
      for (const item of list) installedById[item.pluginId] = item;
      for (const item of list) installedIds.add(item.pluginId);
      for (const id of Object.keys(installedById)) {
        if (!installedIds.has(id)) delete installedById[id];
      }
    } catch (e) {
      logger.error("Action: plugins_list_installed_failed", { key, error: String(e) });
    }
  }

  if (runtimeSupported && !runtimeSyncUnsubscribeByKey.has(key)) {
    const unsubscribe = registerPluginRuntimeStateSyncListener(key, async () => {
      await refreshInstalled();
    });
    runtimeSyncUnsubscribeByKey.set(key, unsubscribe);
  }

  const { install, updateToLatest, switchVersion, rollback, enable, disable, uninstall } =
    createPluginInstallActions({
      key,
      queryPort,
      commandPort,
      runtimeOpsUsecase,
      installedById,
      createProgressHandler,
      setFailedProgress,
      runBusyPluginOperation,
      logger,
    });

  function createCommandError(
    code: PluginCommandErrorCode,
    fallbackMessage: string,
    error?: unknown,
    details?: Readonly<Record<string, unknown>>,
  ): PluginCommandErrorInfo {
    return toPluginCommandErrorInfo(code, fallbackMessage, error, details);
  }

  function rejectInstall(error: PluginCommandErrorInfo): InstallPluginOutcome {
    return { ok: false, kind: "plugin_install_rejected", error };
  }

  function rejectUpdate(error: PluginCommandErrorInfo): UpdatePluginToLatestOutcome {
    return { ok: false, kind: "plugin_update_rejected", error };
  }

  function rejectSwitch(error: PluginCommandErrorInfo): SwitchPluginVersionOutcome {
    return { ok: false, kind: "plugin_switch_version_rejected", error };
  }

  function rejectRollback(error: PluginCommandErrorInfo): RollbackPluginOutcome {
    return { ok: false, kind: "plugin_rollback_rejected", error };
  }

  function rejectEnable(error: PluginCommandErrorInfo): EnablePluginOutcome {
    return { ok: false, kind: "plugin_enable_rejected", error };
  }

  function rejectDisable(error: PluginCommandErrorInfo): DisablePluginOutcome {
    return { ok: false, kind: "plugin_disable_rejected", error };
  }

  function rejectUninstall(error: PluginCommandErrorInfo): UninstallPluginOutcome {
    return { ok: false, kind: "plugin_uninstall_rejected", error };
  }

  function isBusy(pluginId: string): boolean {
    return busyIdsRef.value.has(pluginId);
  }

  function readInstalledVersion(pluginId: string): string {
    return String(installedById[pluginId]?.currentVersion ?? "").trim();
  }

  function resolveRollbackVersion(installed: InstalledPluginState | undefined): string {
    const versions = installed?.installedVersions ?? [];
    const current = installed?.currentVersion ?? "";
    for (const version of versions) {
      if (version && version !== current) return version;
    }
    return "";
  }

  function ensureWorkspaceAvailable(pluginId: string) {
    if (key !== NO_SERVER_KEY) return null;
    return createCommandError("missing_server_socket", "Missing server socket.", undefined, { pluginId });
  }

  async function runInstall(plugin: PluginCatalogEntryLike, version: string): Promise<InstallPluginOutcome> {
    const pluginId = String(plugin?.pluginId ?? "").trim();
    const targetVersion = String(version ?? "").trim();
    const workspaceError = ensureWorkspaceAvailable(pluginId);
    if (workspaceError) return rejectInstall(workspaceError);
    if (!pluginId) return rejectInstall(createCommandError("missing_plugin_id", "Missing plugin id."));
    if (!targetVersion) return rejectInstall(createCommandError("missing_plugin_version", "Missing plugin version.", undefined, { pluginId }));
    if (isBusy(pluginId)) {
      return rejectInstall(createCommandError("plugin_busy", "Plugin operation is already in progress.", undefined, { pluginId }));
    }
    try {
      await install(plugin, targetVersion);
      return {
        ok: true,
        kind: "plugin_installed",
        pluginId,
        version: readInstalledVersion(pluginId) || targetVersion,
      };
    } catch (error) {
      return rejectInstall(createCommandError("plugin_operation_failed", "Plugin install failed.", error, { pluginId, version: targetVersion }));
    }
  }

  async function runUpdateToLatest(
    plugin: PluginCatalogEntryLike,
    latestVersion: string,
  ): Promise<UpdatePluginToLatestOutcome> {
    const pluginId = String(plugin?.pluginId ?? "").trim();
    const targetVersion = String(latestVersion ?? "").trim();
    const workspaceError = ensureWorkspaceAvailable(pluginId);
    if (workspaceError) return rejectUpdate(workspaceError);
    if (!pluginId) return rejectUpdate(createCommandError("missing_plugin_id", "Missing plugin id."));
    if (!targetVersion) return rejectUpdate(createCommandError("missing_plugin_version", "Missing target plugin version.", undefined, { pluginId }));
    if (isBusy(pluginId)) {
      return rejectUpdate(createCommandError("plugin_busy", "Plugin operation is already in progress.", undefined, { pluginId }));
    }
    try {
      await updateToLatest(plugin, targetVersion);
      return {
        ok: true,
        kind: "plugin_updated_to_latest",
        pluginId,
        version: readInstalledVersion(pluginId) || targetVersion,
      };
    } catch (error) {
      return rejectUpdate(createCommandError("plugin_operation_failed", "Plugin update failed.", error, { pluginId, version: targetVersion }));
    }
  }

  async function runSwitchVersion(pluginIdInput: string, version: string): Promise<SwitchPluginVersionOutcome> {
    const pluginId = String(pluginIdInput ?? "").trim();
    const targetVersion = String(version ?? "").trim();
    const workspaceError = ensureWorkspaceAvailable(pluginId);
    if (workspaceError) return rejectSwitch(workspaceError);
    if (!pluginId) return rejectSwitch(createCommandError("missing_plugin_id", "Missing plugin id."));
    if (!targetVersion) return rejectSwitch(createCommandError("missing_plugin_version", "Missing target plugin version.", undefined, { pluginId }));
    if (isBusy(pluginId)) {
      return rejectSwitch(createCommandError("plugin_busy", "Plugin operation is already in progress.", undefined, { pluginId }));
    }
    try {
      await switchVersion(pluginId, targetVersion);
      return {
        ok: true,
        kind: "plugin_version_switched",
        pluginId,
        version: readInstalledVersion(pluginId) || targetVersion,
      };
    } catch (error) {
      return rejectSwitch(createCommandError("plugin_operation_failed", "Plugin version switch failed.", error, { pluginId, version: targetVersion }));
    }
  }

  async function runRollback(pluginIdInput: string): Promise<RollbackPluginOutcome> {
    const pluginId = String(pluginIdInput ?? "").trim();
    const workspaceError = ensureWorkspaceAvailable(pluginId);
    if (workspaceError) return rejectRollback(workspaceError);
    if (!pluginId) return rejectRollback(createCommandError("missing_plugin_id", "Missing plugin id."));
    const targetVersion = resolveRollbackVersion(installedById[pluginId]);
    if (!targetVersion) {
      return rejectRollback(createCommandError("missing_plugin_version", "Missing rollback target version.", undefined, { pluginId }));
    }
    if (isBusy(pluginId)) {
      return rejectRollback(createCommandError("plugin_busy", "Plugin operation is already in progress.", undefined, { pluginId }));
    }
    try {
      await rollback(pluginId);
      return {
        ok: true,
        kind: "plugin_rolled_back",
        pluginId,
        version: readInstalledVersion(pluginId) || targetVersion,
      };
    } catch (error) {
      return rejectRollback(createCommandError("plugin_operation_failed", "Plugin rollback failed.", error, { pluginId, version: targetVersion }));
    }
  }

  async function runEnable(pluginIdInput: string): Promise<EnablePluginOutcome> {
    const pluginId = String(pluginIdInput ?? "").trim();
    const workspaceError = ensureWorkspaceAvailable(pluginId);
    if (workspaceError) return rejectEnable(workspaceError);
    if (!pluginId) return rejectEnable(createCommandError("missing_plugin_id", "Missing plugin id."));
    if (isBusy(pluginId)) {
      return rejectEnable(createCommandError("plugin_busy", "Plugin operation is already in progress.", undefined, { pluginId }));
    }
    try {
      await enable(pluginId);
      return {
        ok: true,
        kind: "plugin_enabled",
        pluginId,
        version: readInstalledVersion(pluginId),
      };
    } catch (error) {
      return rejectEnable(createCommandError("plugin_operation_failed", "Plugin enable failed.", error, { pluginId }));
    }
  }

  async function runDisable(pluginIdInput: string): Promise<DisablePluginOutcome> {
    const pluginId = String(pluginIdInput ?? "").trim();
    const workspaceError = ensureWorkspaceAvailable(pluginId);
    if (workspaceError) return rejectDisable(workspaceError);
    if (!pluginId) return rejectDisable(createCommandError("missing_plugin_id", "Missing plugin id."));
    if (isBusy(pluginId)) {
      return rejectDisable(createCommandError("plugin_busy", "Plugin operation is already in progress.", undefined, { pluginId }));
    }
    try {
      await disable(pluginId);
      return {
        ok: true,
        kind: "plugin_disabled",
        pluginId,
      };
    } catch (error) {
      return rejectDisable(createCommandError("plugin_operation_failed", "Plugin disable failed.", error, { pluginId }));
    }
  }

  async function runUninstall(pluginIdInput: string): Promise<UninstallPluginOutcome> {
    const pluginId = String(pluginIdInput ?? "").trim();
    const workspaceError = ensureWorkspaceAvailable(pluginId);
    if (workspaceError) return rejectUninstall(workspaceError);
    if (!pluginId) return rejectUninstall(createCommandError("missing_plugin_id", "Missing plugin id."));
    if (isBusy(pluginId)) {
      return rejectUninstall(createCommandError("plugin_busy", "Plugin operation is already in progress.", undefined, { pluginId }));
    }
    try {
      await uninstall(pluginId);
      return {
        ok: true,
        kind: "plugin_uninstalled",
        pluginId,
      };
    } catch (error) {
      return rejectUninstall(createCommandError("plugin_operation_failed", "Plugin uninstall failed.", error, { pluginId }));
    }
  }

  const { recheckRequired, isInstalled, isEnabled, isFailed } = createPluginInstallSelectors({
    installedById,
    missingRequiredIdsRef,
  });

  const store: InstallStore = {
    installedById,
    progressById,
    busyIds: computed(() => busyIdsRef.value),
    missingRequiredIds: missingRequiredIdsRef,
    refreshInstalled,
    install: runInstall,
    updateToLatest: runUpdateToLatest,
    switchVersion: runSwitchVersion,
    rollback: runRollback,
    enable: runEnable,
    disable: runDisable,
    uninstall: runUninstall,
    recheckRequired,
    isInstalled,
    isEnabled,
    isFailed,
  };

  stores.set(key, store);
  return store;
}
