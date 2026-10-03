/**
 * @fileoverview domainRegistryStore.ts
 * @description plugins｜展示层状态（store）：domainRegistryStore（Cordis runtime 版）。
 *
 * 该 store 是以下两类能力之间的桥梁：
 * - 插件生命周期状态：installed/enabled/currentVersion
 * - chat UI 的需求：渲染某个 domain 的消息；为某个 domain 挂载 composer
 *
 * 说明（Cordis 重构后）：
 * - 每个 server 拥有一棵独立 Cordis `Context` 树（`createServerRuntime`）；
 * - 插件加载/启用/禁用由 `applyPlugin` / `fiber.dispose()` 驱动，不再自研 scope；
 * - 对外仍通过 Vue 响应式的 `bindingByDomain` 投影向 chat 提供 domain 绑定；
 * - `getContextForPlugin` / `getContextForDomain` 返回插件的 Cordis 上下文（chat 侧视为 unknown）。
 */

import { markRaw, reactive, ref, type Ref } from "vue";
import { USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { createLogger } from "@/shared/utils/logger";
import { normalizeServerKey } from "@/shared/serverKey";
import type { DomainBinding, DomainRegistryHostBridge } from "@/features/plugins/contracts/domainRegistry";
import { getPluginInstallQueryPort, getPluginLifecycleCommandPort } from "@/features/plugins/di/plugins.di";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import { getRuntimeEntry, getRuntimeEntryForVersion } from "@/features/plugins/presentation/runtime/pluginRuntime";
import { createPluginRuntimeError } from "@/features/plugins/presentation/runtime/pluginRuntimeError";
import { assertPluginRuntimeHostCompatible } from "@/features/plugins/domain/policies/pluginHostCompatibility";
import { chatPluginMessagesBridge, chatPluginUiBridge } from "@/features/chat/public/api";
import { getCurrentPluginUserId } from "@/features/plugins/integration/accountSession";
import {
  applyPlugin,
  createServerRuntime,
  loadPluginRuntimeModule,
  type AppliedPlugin,
  type LoadedPluginRuntime,
  type ServerRuntime,
} from "@/features/plugins/runtime";
import { registerServerScopeCleanupHandler } from "@/shared/utils/serverScopeLifecycle";
import {
  clearPluginRuntimeStateSyncListeners,
  notifyPluginRuntimeStateChanged,
} from "./pluginRuntimeStateSync";
import { createDomainRegistryReconciler } from "./domainRegistryReconciler";

type DomainRegistryStore = {
  loadedById: Record<string, LoadedPluginRuntime>;
  runtimeById: Record<string, PluginRuntimeEntry>;
  bindingByDomain: Record<string, DomainBinding>;
  loading: Ref<boolean>;
  error: Ref<string>;
  ensureLoaded(): Promise<void>;
  enablePluginRuntime(pluginId: string): Promise<void>;
  disablePluginRuntime(pluginId: string): Promise<void>;
  tryLoadVersion(pluginId: string, version: string): Promise<LoadedPluginRuntime>;
  getContextForPlugin(pluginId: string): unknown;
  getContextForDomain(domain: string): unknown;
  setHostBridge(bridge: DomainRegistryHostBridge | null): void;
};

const logger = createLogger("domainRegistryStore");
const stores = new Map<string, DomainRegistryStore>();
let runtimeStarted = false;
let stopRuntimeCleanup: (() => void) | null = null;

function currentLang(): string {
  return typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
}

async function disposeDomainRegistryStore(store: DomainRegistryStore): Promise<void> {
  for (const pluginId of Object.keys(store.loadedById)) {
    await store.disablePluginRuntime(pluginId);
  }
  store.setHostBridge(null);
}

// serverRuntime 按 store 隔离保存（不进入 Vue 响应式）。
const serverRuntimes = new WeakMap<DomainRegistryStore, ServerRuntime>();

/**
 * 启动 domain-registry 运行时（幂等）。
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
          disposeDomainRegistryStore(store)
            .then(() => serverRuntimes.get(store)?.dispose())
            .finally(() => {
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
    await serverRuntimes.get(store)?.dispose();
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
      disposeDomainRegistryStore(store)
        .then(() => serverRuntimes.get(store)?.dispose())
        .finally(() => {
          stores.delete(key);
        }),
    );
  }
  await Promise.all(tasks);
}

/**
 * 获取（或创建）指定 server socket 对应的 domain 注册表 store。
 *
 * @param serverSocket - 服务器 Socket 地址（作为 store key）。
 * @returns store 实例。
 */
export function useDomainRegistryStore(serverSocket: string): DomainRegistryStore {
  const key = normalizeServerKey(serverSocket);
  const existing = stores.get(key);
  if (existing) return existing;

  const loadedById = reactive<Record<string, LoadedPluginRuntime>>({});
  const runtimeById = reactive<Record<string, PluginRuntimeEntry>>({});
  const bindingByDomain = reactive<Record<string, DomainBinding>>({});
  const loading = ref(false);
  const error = ref("");
  const runtimeLoadingDisabled = false;
  const queryPort = getPluginInstallQueryPort();
  const commandPort = getPluginLifecycleCommandPort();

  let hostBridge: DomainRegistryHostBridge | null = null;

  if (USE_MOCK_TRANSPORT) {
    logger.info("Action: plugins_runtime_transport_protocol", { key });
  }

  // server runtime：hostBridge / uid 通过闭包实时读取，无需重建。
  const serverRuntime: ServerRuntime = createServerRuntime({
    serverSocket: key,
    serverId: key,
    getCid: () => String(hostBridge?.getCid() ?? "").trim(),
    getUid: () => getCurrentPluginUserId(),
    lang: currentLang(),
  });

  const appliedByPlugin = new Map<string, AppliedPlugin>();

  /** 从共享注册表刷新 Vue 响应式绑定投影（组件 markRaw 防深度代理）。 */
  function refreshBindings(): void {
    const list = serverRuntime.registry.list();
    for (const domain of Object.keys(bindingByDomain)) {
      if (!(domain in list)) delete bindingByDomain[domain];
    }
    for (const [domain, binding] of Object.entries(list)) {
      bindingByDomain[domain] = {
        ...binding,
        renderer: binding.renderer ? markRaw(binding.renderer) : undefined,
        composer: binding.composer ? markRaw(binding.composer) : undefined,
      };
    }
  }

  async function enableLoadedRuntime(runtime: PluginRuntimeEntry, loaded: LoadedPluginRuntime): Promise<void> {
    const id = runtime.pluginId;
    // 幂等：先清理同 id 的旧实例
    await disablePluginRuntime(id);
    // 预置 providesDomains 绑定（无渲染器的 domain 也保留 binding，供降级提示）。
    serverRuntime.registry.seed(runtime);
    const applied = await applyPlugin(serverRuntime.ctx, {
      serverSocket: key,
      registry: serverRuntime.registry,
      uiBridge: chatPluginUiBridge,
      messagesReader: chatPluginMessagesBridge,
      sendMessage: async (payload) => {
        if (!hostBridge) {
          throw createPluginRuntimeError(
            "missing_plugin_host_bridge",
            "Host bridge not set: cannot send message",
            { pluginId: id, serverSocket: key },
          );
        }
        await hostBridge.sendMessage(payload);
      },
    }, runtime, loaded.plugin);
    appliedByPlugin.set(id, applied);
    // markRaw：LoadedPluginRuntime 含 Cordis 插件对象（函数/模块命名空间），
    // 不应被 Vue 深度代理（既无意义也可能触发警告）。
    loadedById[id] = markRaw(loaded);
    runtimeById[id] = runtime;
    refreshBindings();
  }

  /**
   * 启用插件运行时：加载模块并应用（apply）。
   */
  async function enablePluginRuntime(pluginId: string): Promise<void> {
    if (runtimeLoadingDisabled) return;
    const id = pluginId.trim();
    if (!id) return;
    const runtime = await getRuntimeEntry(key, id);
    assertPluginRuntimeHostCompatible(runtime);
    const loaded = await loadPluginRuntimeModule(runtime);
    try {
      await enableLoadedRuntime(runtime, loaded);
    } catch (e) {
      logger.error("Action: plugins_activate_failed", { key, pluginId: id, error: String(e) });
      // 应用失败：回滚残留状态，保证后续可重试
      appliedByPlugin.delete(id);
      delete loadedById[id];
      delete runtimeById[id];
      serverRuntime.registry.unregister(id);
      refreshBindings();
      throw e;
    }
  }

  /**
   * 禁用插件运行时：销毁 Cordis fiber 并反注册 domain。
   */
  async function disablePluginRuntime(pluginId: string): Promise<void> {
    const id = pluginId.trim();
    if (!id) return;
    const applied = appliedByPlugin.get(id) ?? null;
    appliedByPlugin.delete(id);
    delete loadedById[id];
    delete runtimeById[id];
    if (applied) {
      try {
        await applied.dispose();
      } catch (e) {
        logger.error("Action: plugins_deactivate_failed", { key, pluginId: id, error: String(e) });
      }
    }
    serverRuntime.registry.unregister(id);
    refreshBindings();
  }

  /**
   * 尝试加载某个已安装版本（不修改"已安装状态"），用于升级/切换前的预校验。
   */
  async function tryLoadVersion(pluginId: string, version: string): Promise<LoadedPluginRuntime> {
    const id = pluginId.trim();
    const runtime = await getRuntimeEntryForVersion(key, id, version);
    assertPluginRuntimeHostCompatible(runtime);
    return loadPluginRuntimeModule(runtime);
  }

  function getContextForPlugin(pluginId: string): unknown {
    const id = String(pluginId ?? "").trim();
    if (!id) return null;
    return appliedByPlugin.get(id)?.ctx ?? null;
  }

  function getContextForDomain(domain: string): unknown {
    const normalizedDomain = String(domain ?? "").trim();
    if (!normalizedDomain) return null;
    const binding = serverRuntime.registry.get(normalizedDomain);
    if (!binding) return null;
    return getContextForPlugin(binding.pluginId);
  }

  function setHostBridge(bridge: DomainRegistryHostBridge | null): void {
    hostBridge = bridge;
  }

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
  serverRuntimes.set(store, serverRuntime);
  return store;
}
