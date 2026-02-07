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
 * 本 store 通过 DI 获取 `PluginManagerPort` 与领域层交互，从而在不修改 UI 的前提下
 * 切换不同实现（mock / Tauri commands）。
 */

import { computed, reactive, ref, type Ref } from "vue";
import { getPluginManagerPort } from "@/features/plugins/di/plugins.di";
import { getApplyPluginRuntimeOpsUsecase } from "@/features/plugins/di/plugins.di";
import type { InstalledPluginState, PluginCatalogEntry, PluginProgress } from "@/features/plugins/domain/types/pluginTypes";
import { createLogger } from "@/shared/utils/logger";
import { IS_STORE_MOCK, USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { NO_SERVER_KEY, normalizeServerKey } from "@/shared/serverKey";
import { useDomainRegistryStore } from "@/features/plugins/presentation/store/domainRegistryStore";
import type { PluginRuntimeOpsPort } from "@/features/plugins/domain/usecases/ApplyPluginRuntimeOps";

type InstallStore = {
  installedById: Record<string, InstalledPluginState>;
  progressById: Record<string, PluginProgress | null>;
  busyIds: Readonly<Ref<Set<string>>>;
  missingRequiredIds: Readonly<Ref<string[]>>;
  refreshInstalled(): Promise<void>;
  install(plugin: PluginCatalogEntry, version: string): Promise<void>;
  updateToLatest(plugin: PluginCatalogEntry, latestVersion: string): Promise<void>;
  switchVersion(pluginId: string, version: string): Promise<void>;
  rollback(pluginId: string): Promise<void>;
  enable(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;
  uninstall(pluginId: string): Promise<void>;
  recheckRequired(requiredIds: string[]): void;
  isInstalled(pluginId: string): boolean;
  isEnabled(pluginId: string): boolean;
  isFailed(pluginId: string): boolean;
};

const logger = createLogger("pluginInstallStore");
const stores = new Map<string, InstallStore>();

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

  const installedById = reactive<Record<string, InstalledPluginState>>({});
  const progressById = reactive<Record<string, PluginProgress | null>>({});
  const busyIdsRef = ref<Set<string>>(new Set());
  const missingRequiredIds = ref<string[]>([]);
  const runtimeSupported = !IS_STORE_MOCK && !USE_MOCK_TRANSPORT && key !== NO_SERVER_KEY;
  const domainRegistry = runtimeSupported ? useDomainRegistryStore(key) : null;
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
   * 标记插件为“忙碌态”（有操作进行中），用于 UI 禁用交互。
   *
   * 实现细节：
   * 通过替换 `Set` 实例触发 Vue 观察更新（避免就地 mutate 不触发）。
   *
   * @param pluginId - 目标插件 id。
   * @param busy - 是否标记为忙碌。
   */
  function setBusy(pluginId: string, busy: boolean): void {
    const next = new Set(busyIdsRef.value);
    if (busy) next.add(pluginId);
    else next.delete(pluginId);
    busyIdsRef.value = next;
  }

  /**
   * 创建进度回调：将进度写入 `progressById[targetId]`。
   *
   * 使用工厂函数避免在调用点内联箭头回调，保证“代码即文档”的可读性，
   * 同时让回调与具体 `pluginId` 形成强绑定，减少误用风险。
   *
   * @param targetId - 目标插件 id。
   * @returns 进度回调函数。
   */
  function createProgressHandler(targetId: string): (p: PluginProgress) => void {
    /**
     * 处理后端操作的进度回调。
     *
     * @param p - 进度数据。
     * @returns 无返回值。
     */
    function handleProgress(p: PluginProgress): void {
      progressById[targetId] = p;
    }
    return handleProgress;
  }

  /**
   * 创建延迟清理回调：当插件不处于忙碌态时，清空 `progressById[targetId]`。
   *
   * @param targetId - 目标插件 id。
   * @returns `setTimeout` 回调。
   */
  function createClearProgressHandler(targetId: string): () => void {
    /**
     * 当该插件没有其他操作运行时，清理进度 UI。
     *
     * @returns 无返回值。
     */
    function handleClear(): void {
      if (!busyIdsRef.value.has(targetId)) progressById[targetId] = null;
    }
    return handleClear;
  }

  /**
   * 延迟清理进度 UI。
   *
   * 延迟用于避免操作瞬时完成导致的闪烁，并让用户能感知到成功态。
   *
   * @param targetId - 目标插件 id。
   * @returns 无返回值。
   */
  function scheduleProgressClear(targetId: string): void {
    window.setTimeout(createClearProgressHandler(targetId), 900);
  }

  /**
   * 校验某个版本是否能被运行时动态加载（import）。
   *
   * @param pluginId - 插件 id。
   * @param version - 需要校验的已安装版本号。
   * @returns 无返回值。
   */
  async function validateRuntimeVersion(pluginId: string, version: string): Promise<void> {
    if (!domainRegistry) return;
    await domainRegistry.tryLoadVersion(pluginId, version);
  }

  /**
   * 重新加载插件运行时（disable + enable），用于切换版本/修复加载态。
   *
   * @param pluginId - 插件 id。
   * @returns 无返回值。
   */
  async function reloadRuntime(pluginId: string): Promise<void> {
    if (!domainRegistry) return;
    await domainRegistry.disablePluginRuntime(pluginId);
    await domainRegistry.enablePluginRuntime(pluginId);
  }

  /**
   * 禁用插件运行时（尽力而为）。
   *
   * @param pluginId - 插件 id。
   * @returns 无返回值。
   */
  async function disableRuntime(pluginId: string): Promise<void> {
    if (!domainRegistry) return;
    await domainRegistry.disablePluginRuntime(pluginId);
  }

  /**
   * 判断某插件 id 是否存在于后端返回的已安装列表中。
   *
   * @param list - 后端已安装列表。
   * @param pluginId - 目标插件 id。
   * @returns 存在则为 `true`。
   */
  function listContainsInstalledId(list: InstalledPluginState[], pluginId: string): boolean {
    for (const x of list) {
      if (x.pluginId === pluginId) return true;
    }
    return false;
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
      const list = await getPluginManagerPort().listInstalled(key);
      for (const item of list) installedById[item.pluginId] = item;
      for (const id of Object.keys(installedById)) {
        if (!listContainsInstalledId(list, id)) delete installedById[id];
      }
    } catch (e) {
      logger.error("Action: plugins_list_installed_failed", { key, error: String(e) });
    }
  }

  /**
   * 安装指定插件版本。
   *
   * UI 约定：
   * - 操作期间写入 `progressById[pluginId]`（卡片/抽屉展示进度）；
   * - 完成后延迟清理进度（除非紧接着又开始了新操作）；
   * - 失败时尽量回填/刷新最近一次已知的安装状态。
   *
   * @param plugin - 插件目录条目（用于决定安装来源）。
   * @param version - 目标版本。
   * @returns 无返回值。
   */
  async function install(plugin: PluginCatalogEntry, version: string): Promise<void> {
    const id = String(plugin?.pluginId ?? "").trim();
    const source = plugin?.source ?? "server";
    if (!id) return;
    const onProgress = createProgressHandler(id);
    setBusy(id, true);
    progressById[id] = { pluginId: id, stage: "confirm", percent: 0, message: "Starting…" };
    try {
      const next =
        source === "repo"
          ? await getPluginManagerPort().installFromUrl(
              key,
              id,
              version,
              String(plugin.downloadUrl ?? ""),
              String(plugin.sha256 ?? ""),
              onProgress,
            )
          : await getPluginManagerPort().install(key, id, version, onProgress);
      installedById[id] = next;
    } catch (e) {
      logger.error("Action: plugins_install_failed", { key, pluginId: id, error: String(e) });
      progressById[id] = { pluginId: id, stage: "failed", percent: 100, message: String(e) || "Failed" };
      const existing = await getPluginManagerPort().getInstalledState(key, id);
      if (existing) installedById[id] = existing;
    } finally {
      setBusy(id, false);
      scheduleProgressClear(id);
    }
  }

  /**
   * 将插件更新到指定“最新版本”。
   *
   * 行为：
   * - 安装目标版本（此时不切换当前版本）；
   * - 校验新版本可被运行时动态加载；
   * - 切换当前版本到新版本；
   * - 若插件之前处于启用态，则尝试 reload runtime；失败则自动回滚。
   *
   * @param plugin - 插件目录条目（用于决定安装来源）。
   * @param latestVersion - 目标版本（通常为目录的最新版）。
   * @returns 无返回值。
   */
  async function updateToLatest(plugin: PluginCatalogEntry, latestVersion: string): Promise<void> {
    const id = String(plugin?.pluginId ?? "").trim();
    const v = latestVersion.trim();
    if (!id || !v) return;
    const onProgress = createProgressHandler(id);
    setBusy(id, true);
    progressById[id] = { pluginId: id, stage: "checking_updates", percent: 10, message: "Checking updates…" };
    try {
      const before = installedById[id] ?? (await getPluginManagerPort().getInstalledState(key, id));
      await runtimeOpsUsecase.updateToLatest({
        serverSocket: key,
        plugin,
        latestVersion: v,
        before,
        onProgress,
        onState(state: InstalledPluginState): void {
          installedById[id] = state;
        },
        setProgress(p: PluginProgress): void {
          progressById[id] = p;
        },
      });
    } catch (e) {
      logger.error("Action: plugins_update_failed", { key, pluginId: id, error: String(e) });
      progressById[id] = { pluginId: id, stage: "failed", percent: 100, message: String(e) || "Failed" };
      const existing = await getPluginManagerPort().getInstalledState(key, id);
      if (existing) installedById[id] = existing;
    } finally {
      setBusy(id, false);
      scheduleProgressClear(id);
    }
  }

  /**
   * 切换已安装插件的“当前启用版本”。
   *
   * @param pluginId - 插件 id。
   * @param version - 目标已安装版本号。
   * @returns 无返回值。
   */
  async function switchVersion(pluginId: string, version: string): Promise<void> {
    const id = pluginId.trim();
    const v = version.trim();
    if (!id || !v) return;
    const before = installedById[id] ?? null;
    const prev = before?.currentVersion ?? "";
    const wasEnabled = Boolean(before?.enabled && before?.status === "ok" && before?.currentVersion);
    const onProgress = createProgressHandler(id);
    setBusy(id, true);
    progressById[id] = { pluginId: id, stage: "switching", percent: 22, message: "Switching version…" };
    try {
      await runtimeOpsUsecase.switchVersion({
        serverSocket: key,
        pluginId: id,
        version: v,
        before,
        onProgress,
        onState(state: InstalledPluginState): void {
          installedById[id] = state;
        },
        setProgress(p: PluginProgress): void {
          progressById[id] = p;
        },
      });
    } catch (e) {
      logger.error("Action: plugins_switch_version_failed", { key, pluginId: id, error: String(e) });
      progressById[id] = { pluginId: id, stage: "failed", percent: 100, message: String(e) || "Failed" };
      if (wasEnabled && prev && runtimeSupported) {
        try {
          const rolled = await getPluginManagerPort().switchVersion(key, id, prev);
          installedById[id] = rolled;
          await reloadRuntime(id);
        } catch (re) {
          logger.error("Action: plugins_switch_rollback_failed", { key, pluginId: id, error: String(re) });
        }
      }
      const existing = await getPluginManagerPort().getInstalledState(key, id);
      if (existing) installedById[id] = existing;
    } finally {
      setBusy(id, false);
      scheduleProgressClear(id);
    }
  }

  /**
   * 回滚到先前已安装的某个版本（简单策略：选择一个不同于 current 的版本）。
   *
   * 当前策略：
   * - 从 `installedVersions` 中选取第一个与 `currentVersion` 不同的版本；
   * - 若插件当前处于启用态，切换版本后重新加载以保持启用。
   *
   * @param pluginId - 插件 id。
   * @returns 无返回值。
   */
  async function rollback(pluginId: string): Promise<void> {
    const id = pluginId.trim();
    if (!id) return;
    const installed = installedById[id];
    const versions = installed?.installedVersions ?? [];
    const current = installed?.currentVersion ?? "";
    let prev = "";
    for (const x of versions) {
      if (x && x !== current) {
        prev = x;
        break;
      }
    }
    if (!prev) return;

    setBusy(id, true);
    progressById[id] = { pluginId: id, stage: "rolling_back", percent: 18, message: "Rolling back…" };
    try {
      const onProgress = createProgressHandler(id);
      await runtimeOpsUsecase.rollback({
        serverSocket: key,
        pluginId: id,
        before: installed,
        onProgress,
        onState(state: InstalledPluginState): void {
          installedById[id] = state;
        },
        setProgress(p: PluginProgress): void {
          progressById[id] = p;
        },
      });
    } catch (e) {
      logger.error("Action: plugins_rollback_failed", { key, pluginId: id, error: String(e) });
      progressById[id] = { pluginId: id, stage: "failed", percent: 100, message: String(e) || "Failed" };
      const existing = await getPluginManagerPort().getInstalledState(key, id);
      if (existing) installedById[id] = existing;
    } finally {
      setBusy(id, false);
      scheduleProgressClear(id);
    }
  }

  /**
   * 启用插件（power on）。
   *
   * @param pluginId - 插件 id。
   * @returns 无返回值。
   */
  async function enable(pluginId: string): Promise<void> {
    const id = pluginId.trim();
    if (!id) return;
    const onProgress = createProgressHandler(id);
    setBusy(id, true);
    progressById[id] = { pluginId: id, stage: "enabling", percent: 18, message: "Enabling…" };
    try {
      await runtimeOpsUsecase.enable({
        serverSocket: key,
        pluginId: id,
        onProgress,
        onState(state: InstalledPluginState): void {
          installedById[id] = state;
        },
      });
    } catch (e) {
      logger.error("Action: plugins_enable_failed", { key, pluginId: id, error: String(e) });
      progressById[id] = { pluginId: id, stage: "failed", percent: 100, message: String(e) || "Failed" };
      const existing = await getPluginManagerPort().getInstalledState(key, id);
      if (existing) installedById[id] = existing;
    } finally {
      setBusy(id, false);
      scheduleProgressClear(id);
    }
  }

  /**
   * 禁用插件（power off）。
   *
   * @param pluginId - 插件 id。
   * @returns 无返回值。
   */
  async function disable(pluginId: string): Promise<void> {
    const id = pluginId.trim();
    if (!id) return;
    setBusy(id, true);
    try {
      const next = await getPluginManagerPort().disable(key, id);
      if (next) installedById[id] = next;
      if (runtimeSupported) await disableRuntime(id);
    } catch (e) {
      logger.error("Action: plugins_disable_failed", { key, pluginId: id, error: String(e) });
    } finally {
      setBusy(id, false);
    }
  }

  /**
   * 卸载插件（在当前服务端上下文下从本机彻底移除）。
   *
   * @param pluginId - 插件 id。
   * @returns 无返回值。
   */
  async function uninstall(pluginId: string): Promise<void> {
    const id = pluginId.trim();
    if (!id) return;
    setBusy(id, true);
    try {
      if (runtimeSupported) await disableRuntime(id);
      await getPluginManagerPort().uninstall(key, id);
      delete installedById[id];
    } catch (e) {
      logger.error("Action: plugins_uninstall_failed", { key, pluginId: id, error: String(e) });
    } finally {
      setBusy(id, false);
    }
  }

  /**
   * 根据“服务端要求的插件列表”重新计算缺失项。
   *
   * 该结果用于驱动 `/required-setup` 等 UI gate。
   *
   * @param requiredIds - 服务端标记为 required 的插件 id 列表。
   * @returns 无返回值。
   */
  function recheckRequired(requiredIds: string[]): void {
    const missing: string[] = [];
    for (const id of requiredIds) {
      const ok = Boolean(installedById[id]?.enabled) && installedById[id]?.status === "ok";
      if (!ok) missing.push(id);
    }
    missingRequiredIds.value = missing;
  }

  /**
   * 判断是否“已安装”（存在 currentVersion）。
   *
   * @param pluginId - 插件 id。
   * @returns 已安装则为 `true`。
   */
  function isInstalled(pluginId: string): boolean {
    return Boolean(installedById[pluginId]?.currentVersion);
  }

  /**
   * 判断是否“已启用”（enabled=true 且 status=ok）。
   *
   * @param pluginId - 插件 id。
   * @returns 已启用则为 `true`。
   */
  function isEnabled(pluginId: string): boolean {
    return Boolean(installedById[pluginId]?.enabled && installedById[pluginId]?.status === "ok");
  }

  /**
   * 判断是否“失败态”（status=failed）。
   *
   * @param pluginId - 插件 id。
   * @returns 失败态则为 `true`。
   */
  function isFailed(pluginId: string): boolean {
    return Boolean(installedById[pluginId]?.status === "failed");
  }

  /**
   * 以 computed 的形式暴露 busy-id 集合。
   *
   * @returns busy id 集合。
   */
  function computeBusyIds(): Set<string> {
    return busyIdsRef.value;
  }

  const store: InstallStore = {
    installedById,
    progressById,
    busyIds: computed(computeBusyIds),
    missingRequiredIds,
    refreshInstalled,
    install,
    updateToLatest,
    switchVersion,
    rollback,
    enable,
    disable,
    uninstall,
    recheckRequired,
    isInstalled,
    isEnabled,
    isFailed,
  };

  stores.set(key, store);
  return store;
}
