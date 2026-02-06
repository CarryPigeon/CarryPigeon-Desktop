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
import type { Component } from "vue";
import { USE_MOCK_API } from "@/shared/config/runtime";
import { createLogger } from "@/shared/utils/logger";
import { NO_SERVER_KEY, normalizeServerKey } from "@/shared/serverKey";
import { currentUser } from "@/features/user/api";
import { getPluginManagerPort } from "@/features/plugins/api";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import type { PluginComposerPayload, PluginContext } from "@/features/plugins/domain/types/pluginRuntimeTypes";
import {
  createPluginNetworkApi,
  createPluginStorageApi,
  getRuntimeEntry,
  getRuntimeEntryForVersion,
  importPluginModule,
  normalizePluginModule,
  toAppPluginEntryUrl,
  type LoadedPluginModule,
} from "@/features/plugins/presentation/runtime/pluginRuntime";

/**
 * domain 与插件的绑定关系（domain -> renderer/composer/contract）。
 *
 * 说明：
 * - 该结构是 UI 侧“按 domain 查找组件”的关键索引；
 * - `renderer/composer/contract` 均为可选：插件可能只提供其中一种能力。
 */
export type DomainBinding = {
  pluginId: string;
  pluginVersion: string;
  domain: string;
  domainVersion: string;
  renderer?: Component;
  composer?: Component;
  contract?: unknown;
};

/**
 * DomainRegistryStore 的宿主桥接接口（由 chat/host 注入）。
 *
 * 说明：
 * - 该桥接用于避免 domainRegistryStore 直接依赖 chat store（防循环依赖）；
 * - `getCid` 用于动态获取当前频道 id；
 * - `sendMessage` 用于把插件 composer 的提交转发到宿主发送链路。
 */
export type DomainRegistryHostBridge = {
  getCid(): string;
  sendMessage(payload: PluginComposerPayload): Promise<void>;
};

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

  let hostBridge: DomainRegistryHostBridge | null = null;

  /**
   * 基于 runtime 条目构建插件上下文（PluginContext）。
   *
   * 约定：
   * - `server_socket`：使用当前 store 的 key；当 key 为 `NO_SERVER_KEY` 时写入空字符串。
   * - `cid`：通过 `hostBridge.getCid()` 动态获取，保证随频道切换实时更新。
   *
   * @param runtime - 插件 runtime 条目（包含 serverId/version 等）。
   * @param plugin - 已加载的插件模块。
   * @returns 插件上下文。
   */
  function buildPluginContext(runtime: PluginRuntimeEntry, plugin: LoadedPluginModule): PluginContext {
    const socket = key === NO_SERVER_KEY ? "" : key;
    const cid = String(hostBridge?.getCid() ?? "").trim();
    const uid = String(currentUser.id ?? "").trim();
    const lang = navigator.language || "en-US";

    const permissions = new Set(plugin.permissions.map((x) => String(x).trim()).filter(Boolean));
    const storage = createPluginStorageApi(socket, plugin.pluginId);
    const network = permissions.has("network") ? createPluginNetworkApi(socket) : undefined;

    return {
      server_socket: socket,
      server_id: runtime.serverId,
      plugin_id: plugin.pluginId,
      plugin_version: runtime.version,
      cid,
      uid,
      lang,
      host: {
        async sendMessage(payload: PluginComposerPayload): Promise<void> {
          const bridge = hostBridge;
          if (!bridge) throw new Error("Host bridge not set: cannot send message");
          await bridge.sendMessage(payload);
        },
        storage,
        network,
      },
    };
  }

  /**
   * 将插件模块声明的 domain 注册到绑定表中。
   *
   * @param plugin - 已加载的插件模块。
   * @returns 无返回值。
   */
  function registerDomains(plugin: LoadedPluginModule): void {
    for (const item of plugin.providesDomains) {
      const domain = String(item.domain ?? "").trim();
      const domainVersion = String(item.domainVersion ?? "").trim() || "1.0.0";
      if (!domain) continue;
      const binding: DomainBinding = {
        pluginId: plugin.pluginId,
        pluginVersion: plugin.version,
        domain,
        domainVersion,
        renderer: plugin.renderers[domain],
        composer: plugin.composers[domain],
        contract: plugin.contracts.find((c) => String(c.domain ?? "").trim() === domain),
      };
      bindingByDomain[domain] = binding;
    }
  }

  /**
   * 反注册某个插件的全部 domain 绑定。
   *
   * @param pluginId - 插件 id。
   * @returns 无返回值。
   */
  function unregisterPluginDomains(pluginId: string): void {
    for (const k of Object.keys(bindingByDomain)) {
      if (bindingByDomain[k]?.pluginId === pluginId) delete bindingByDomain[k];
    }
  }

  /**
   * 基于 runtime 条目加载插件模块。
   *
   * @param runtime - 插件 runtime 条目。
   * @returns 归一化后的插件模块。
   */
  async function loadFromRuntime(runtime: PluginRuntimeEntry): Promise<LoadedPluginModule> {
    const entryUrl = toAppPluginEntryUrl(runtime);
    const mod = await importPluginModule(entryUrl);
    return normalizePluginModule(runtime.pluginId, runtime.version, runtime, mod);
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
    if (USE_MOCK_API) throw new Error("tryLoadVersion is not supported in mock mode");
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
    if (USE_MOCK_API) return;
    const id = pluginId.trim();
    if (!id) return;

    const runtime = await getRuntimeEntry(key, id);
    const loaded = await loadFromRuntime(runtime);
    const ctx = buildPluginContext(runtime, loaded);

    loadedById[id] = loaded;
    runtimeById[id] = runtime;
    unregisterPluginDomains(id);
    registerDomains(loaded);

    try {
      if (loaded.activate) await Promise.resolve(loaded.activate(ctx));
    } catch (e) {
      logger.error("Action: plugin_activate_failed", { key, pluginId: id, error: String(e) });
      // 激活失败不应导致宿主 UI 崩溃；插件仍保持注册态，但可能不可用。
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
    unregisterPluginDomains(id);
    delete loadedById[id];
    delete runtimeById[id];
    if (!loaded?.deactivate) return;
    try {
      await Promise.resolve(loaded.deactivate());
    } catch (e) {
      logger.error("Action: plugin_deactivate_failed", { key, pluginId: id, error: String(e) });
    }
  }

  /**
   * 获取某插件在“当前频道/用户选择”下的最新上下文。
   *
   * 注意：
   * - 返回的 `cid` 在调用时从 `currentChannelId.value` 读取，确保拿到最新值。
   *
   * @param pluginId - 插件 id。
   * @returns 插件上下文；若插件未加载则返回 `null`。
   */
  function getContextForPlugin(pluginId: string): PluginContext | null {
    if (USE_MOCK_API) return null;
    const id = pluginId.trim();
    if (!id) return null;
    const runtime = runtimeById[id] ?? null;
    const loaded = loadedById[id] ?? null;
    if (!runtime || !loaded) return null;
    return buildPluginContext(runtime, loaded);
  }

  /**
   * 根据 domain 获取对应插件的最新上下文。
   *
   * @param domain - Domain 标识（例如 `Math:Formula`）。
   * @returns 插件上下文；若插件未加载则返回 `null`。
   */
  function getContextForDomain(domain: string): PluginContext | null {
    const d = String(domain ?? "").trim();
    if (!d) return null;
    const binding = bindingByDomain[d] ?? null;
    if (!binding) return null;
    return getContextForPlugin(binding.pluginId);
  }

  /**
   * 设置宿主桥接：用于插件发送消息与读取聊天上下文。
   *
   * 说明：该方法放在展示层 store 内部，避免 plugin runtime registry 与 chat store facade 形成静态循环依赖。
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
  async function ensureLoaded(): Promise<void> {
    if (USE_MOCK_API) return;
    if (key === NO_SERVER_KEY) return;
    loading.value = true;
    error.value = "";
    try {
      const installed = await getPluginManagerPort().listInstalled(key);
      for (const st of installed) {
        if (!st.enabled || st.status !== "ok") continue;
        if (!st.currentVersion) continue;
        if (loadedById[st.pluginId]?.version === st.currentVersion) continue;
        try {
          await enablePluginRuntime(st.pluginId);
        } catch (e) {
          const msg = String(e) || "Runtime load failed";
          logger.error("Action: plugin_runtime_load_failed_marking_failed", { key, pluginId: st.pluginId, error: msg });
          try {
            await getPluginManagerPort().setFailed(key, st.pluginId, msg);
          } catch (se) {
            logger.error("Action: plugin_mark_failed_failed", { key, pluginId: st.pluginId, error: String(se) });
          }
        }
      }
      for (const id of Object.keys(loadedById)) {
        const st = installed.find((x) => x.pluginId === id);
        const shouldBeOn = Boolean(st?.enabled && st?.status === "ok" && st?.currentVersion);
        if (!shouldBeOn) await disablePluginRuntime(id);
      }
    } catch (e) {
      error.value = String(e);
      logger.error("Action: plugin_ensure_loaded_failed", { key, error: String(e) });
    } finally {
      loading.value = false;
    }
  }

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
