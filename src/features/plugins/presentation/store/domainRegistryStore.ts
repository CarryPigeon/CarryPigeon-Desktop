/**
 * @fileoverview domainRegistryStore.ts
 * @description plugins｜展示层状态（store）：domainRegistryStore。
 *
 * 该 store 是以下两类能力之间的桥梁：
 * - 插件生命周期状态：installed/enabled/currentVersion
 * - chat UI 的需求：渲染某个 domain 的消息；为某个 domain 挂载 composer
 *
 * 它会通过 `app://plugins/...` 动态 import 的方式加载“已启用插件”的运行时模块。
 */

import { reactive, ref, type Ref } from "vue";
import { USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { createLogger } from "@/shared/utils/logger";
import { normalizeServerKey } from "@/shared/serverKey";
import type { DomainBinding, DomainRegistryHostBridge } from "@/features/plugins/contracts/domainRegistry";
import { getPluginInstallQueryPort, getPluginLifecycleCommandPort } from "@/features/plugins/di/plugins.di";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import type { PluginContext } from "@/features/plugins/domain/types/pluginRuntimeTypes";
import {
  getRuntimeEntry,
  getRuntimeEntryForVersion,
  type LoadedPluginModule,
} from "@/features/plugins/presentation/runtime/pluginRuntime";
import { registerServerScopeCleanupHandler } from "@/shared/utils/serverScopeLifecycle";
import {
  clearPluginRuntimeStateSyncListeners,
  notifyPluginRuntimeStateChanged,
} from "./pluginRuntimeStateSync";
import { registerPluginDomains, unregisterPluginDomains } from "./domainRegistryBindings";
import { createDomainRegistryContextResolver } from "./domainRegistryContext";
import {
  createNoopLoadedPluginModule as createNoopRuntimeModule,
  isPluginRuntimeLoadingDisabled,
  loadPluginRuntimeModule,
} from "./domainRegistryModuleLoader";
import { createDomainRegistryReconciler } from "./domainRegistryReconciler";

type DomainRegistryStore = {
  loadedById: Record<string, LoadedPluginModule>;
  runtimeById: Record<string, PluginRuntimeEntry>;
  bindingByDomain: Record<string, DomainBinding>;
  loading: Ref<boolean>;
  error: Ref<string>;
  ensureLoaded(): Promise<void>;
  enablePluginRuntime(pluginId: string): Promise<void>;
  disablePluginRuntime(pluginId: string): Promise<void>;
  tryLoadVersion(pluginId: string, version: string): Promise<LoadedPluginModule>;
  getContextForPlugin(pluginId: string): PluginContext | null;
  getContextForDomain(domain: string): PluginContext | null;
  setHostBridge(bridge: DomainRegistryHostBridge | null): void;
};

const logger = createLogger("domainRegistryStore");
const stores = new Map<string, DomainRegistryStore>();
let runtimeStarted = false;
let stopRuntimeCleanup: (() => void) | null = null;

async function disposeDomainRegistryStore(store: DomainRegistryStore): Promise<void> {
  for (const pluginId of Object.keys(store.loadedById)) {
    await store.disablePluginRuntime(pluginId);
  }
  store.setHostBridge(null);
}

/**
 * 启动 domain-registry 运行时（幂等）。
 *
 * 说明：
 * - 显式注册 server-scope 清理回调；
 * - 避免模块加载时产生副作用。
 */
export function startDomainRegistryRuntime(): void {
  if (runtimeStarted) return;
  runtimeStarted = true;
  stopRuntimeCleanup = registerServerScopeCleanupHandler(async (event) => {
    if (event.type === "all") {
      clearPluginRuntimeStateSyncListeners();
      const tasks: Promise<void>[] = [];
      for (const [key, store] of stores.entries()) {
        tasks.push(
          disposeDomainRegistryStore(store).finally(() => {
            stores.delete(key);
          }),
        );
      }
      await Promise.all(tasks);
      return;
    }
    clearPluginRuntimeStateSyncListeners(event.key);
    const store = stores.get(event.key);
    if (!store) return;
    await disposeDomainRegistryStore(store);
    stores.delete(event.key);
  });
}

/**
 * 停止 domain-registry 运行时（best-effort）。
 */
export async function stopDomainRegistryRuntime(): Promise<void> {
  if (!runtimeStarted) return;
  runtimeStarted = false;
  stopRuntimeCleanup?.();
  stopRuntimeCleanup = null;
  clearPluginRuntimeStateSyncListeners();
  const tasks: Promise<void>[] = [];
  for (const [key, store] of stores.entries()) {
    tasks.push(
      disposeDomainRegistryStore(store).finally(() => {
        stores.delete(key);
      }),
    );
  }
  await Promise.all(tasks);
}

/**
 * 获取（或创建）指定 server socket 对应的 domain 注册表 store。
 *
 * 说明：
 * - 该 store 以 `serverSocket` 为 key 做单例缓存，避免重复初始化插件运行时状态。
 *
 * @param serverSocket - 服务器 Socket 地址（作为 store key）。
 * @returns store 实例。
 */
export function useDomainRegistryStore(serverSocket: string): DomainRegistryStore {
  const key = normalizeServerKey(serverSocket);
  const existing = stores.get(key);
  if (existing) return existing;

  const loadedById = reactive<Record<string, LoadedPluginModule>>({});
  const runtimeById = reactive<Record<string, PluginRuntimeEntry>>({});
  const bindingByDomain = reactive<Record<string, DomainBinding>>({});
  const loading = ref(false);
  const error = ref("");
  const runtimeLoadingDisabled = isPluginRuntimeLoadingDisabled();
  const queryPort = getPluginInstallQueryPort();
  const commandPort = getPluginLifecycleCommandPort();

  let hostBridge: DomainRegistryHostBridge | null = null;

  if (runtimeLoadingDisabled) {
    logger.info("Action: plugins_runtime_loading_disabled", {
      key,
      mode: USE_MOCK_TRANSPORT ? "protocol" : "store",
    });
  }
  const contextResolver = createDomainRegistryContextResolver({
    serverKey: key,
    runtimeLoadingDisabled,
    runtimeById,
    loadedById,
    bindingByDomain,
    getHostBridge: () => hostBridge,
  });

  /**
   * 基于 runtime 条目加载插件模块。
   *
   * @param runtime - 插件 runtime 条目。
   * @returns 归一化后的插件模块。
   */
  async function loadFromRuntime(runtime: PluginRuntimeEntry): Promise<LoadedPluginModule> {
    return loadPluginRuntimeModule(runtime);
  }

  /**
   * 尝试加载某个已安装版本（不修改“已安装状态”）。
   *
   * 用于原子升级/切换流程：在切换 currentVersion 之前先校验并预加载。
   *
   * @param pluginId - 插件 id。
   * @param version - 目标版本号。
   * @returns 归一化后的插件模块。
   */
  async function tryLoadVersion(pluginId: string, version: string): Promise<LoadedPluginModule> {
    if (runtimeLoadingDisabled) {
      logger.warn("Action: plugins_runtime_validate_version_skipped", { key, pluginId, version });
      return createNoopRuntimeModule(pluginId, version);
    }
    const runtime = await getRuntimeEntryForVersion(key, pluginId, version);
    return loadFromRuntime(runtime);
  }

  /**
   * 启用插件运行时：加载模块、注册 domain、调用 activate（若存在）。
   *
   * @param pluginId - 插件 id。
   * @returns 无返回值。
   */
  async function enablePluginRuntime(pluginId: string): Promise<void> {
    if (runtimeLoadingDisabled) return;
    const id = pluginId.trim();
    if (!id) return;

    const runtime = await getRuntimeEntry(key, id);
    const loaded = await loadFromRuntime(runtime);
    const ctx = contextResolver.buildPluginContext(runtime, loaded);

    loadedById[id] = loaded;
    runtimeById[id] = runtime;
    unregisterPluginDomains(bindingByDomain, id);
    registerPluginDomains(bindingByDomain, loaded);

    try {
      if (loaded.activate) await Promise.resolve(loaded.activate(ctx));
    } catch (e) {
      logger.error("Action: plugins_activate_failed", { key, pluginId: id, error: String(e) });
      unregisterPluginDomains(bindingByDomain, id);
      delete loadedById[id];
      delete runtimeById[id];
      throw e;
    }
  }

  /**
   * 禁用插件运行时：反注册 domain，并调用 deactivate（若存在）。
   *
   * @param pluginId - 插件 id。
   * @returns 无返回值。
   */
  async function disablePluginRuntime(pluginId: string): Promise<void> {
    const id = pluginId.trim();
    if (!id) return;
    const loaded = loadedById[id] ?? null;
    unregisterPluginDomains(bindingByDomain, id);
    delete loadedById[id];
    delete runtimeById[id];
    if (!loaded?.deactivate) return;
    try {
      await Promise.resolve(loaded.deactivate());
    } catch (e) {
      logger.error("Action: plugins_deactivate_failed", { key, pluginId: id, error: String(e) });
    }
  }

  /**
   * 获取某插件在“当前频道/用户选择”下的最新上下文。
   *
   * 注意：
   * - 返回的 `cid` 在调用时从 `hostBridge.getCid()` 读取，确保拿到最新频道上下文。
   *
   * @param pluginId - 插件 id。
   * @returns 插件上下文；若插件未加载则返回 `null`。
   */
  function getContextForPlugin(pluginId: string): PluginContext | null {
    return contextResolver.getContextForPlugin(pluginId);
  }

  /**
   * 根据 domain 获取对应插件的最新上下文。
   *
   * @param domain - Domain 标识（例如 `Math:Formula`）。
   * @returns 插件上下文；若插件未加载则返回 `null`。
   */
  function getContextForDomain(domain: string): PluginContext | null {
    return contextResolver.getContextForDomain(domain);
  }

  /**
   * 设置宿主桥接：用于插件发送消息与读取聊天上下文。
   *
   * 说明：该方法放在展示层 store 内部，避免 plugin runtime registry 与 chat 聚合 store 形成静态循环依赖。
   *
   * @param bridge - 宿主桥接；传 `null` 表示解除绑定。
   * @returns 无返回值。
   */
  function setHostBridge(bridge: DomainRegistryHostBridge | null): void {
    hostBridge = bridge;
  }

  /**
   * 确保所有“已启用且状态正常”的插件均完成加载（best-effort）。
   *
   * @returns 无返回值。
   */
  const { ensureLoaded } = createDomainRegistryReconciler({
    key,
    runtimeLoadingDisabled,
    loadedById,
    loading,
    error,
    logger,
    listInstalled: () => queryPort.listInstalled(key),
    enablePluginRuntime,
    disablePluginRuntime,
    async markFailed(pluginId, message): Promise<void> {
      await commandPort.setFailed(key, pluginId, message);
    },
    notifyRuntimeStateChanged: () => notifyPluginRuntimeStateChanged(key),
  });

  const store: DomainRegistryStore = {
    loadedById,
    runtimeById,
    bindingByDomain,
    loading,
    error,
    ensureLoaded,
    enablePluginRuntime,
    disablePluginRuntime,
    tryLoadVersion,
    getContextForPlugin,
    getContextForDomain,
    setHostBridge,
  };
  stores.set(key, store);
  return store;
}
