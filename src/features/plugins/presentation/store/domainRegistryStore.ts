/**
 * @fileoverview domainRegistryStore.ts
 * @description Runtime domain registry (per server): maps domain → renderer/composer/contract.
 *
 * This store is the bridge between:
 * - plugin lifecycle state (installed/enabled/currentVersion)
 * - chat UI needs (render a message domain; mount a composer for a domain)
 *
 * It loads enabled plugins via dynamic import from `app://plugins/...`.
 */

import { reactive, ref, type Ref } from "vue";
import type { Component } from "vue";
import { USE_MOCK_API } from "@/shared/config/runtime";
import { createLogger } from "@/shared/utils/logger";
import { currentUser } from "@/features/user/presentation/store/userData";
import { getPluginManagerPort } from "@/features/plugins/di/plugins.di";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import {
  createPluginNetworkApi,
  createPluginStorageApi,
  getRuntimeEntry,
  getRuntimeEntryForVersion,
  importPluginModule,
  normalizePluginModule,
  toAppPluginEntryUrl,
  type LoadedPluginModule,
  type PluginComposerPayload,
  type PluginContext,
} from "@/features/plugins/data/pluginRuntime";

export type DomainBinding = {
  pluginId: string;
  pluginVersion: string;
  domain: string;
  domainVersion: string;
  renderer?: Component;
  composer?: Component;
  contract?: unknown;
};

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
 * Get (or create) domain registry store for a server socket.
 *
 * @param serverSocket - Server socket key.
 * @returns Store instance.
 */
export function useDomainRegistryStore(serverSocket: string): DomainRegistryStore {
  const key = serverSocket.trim() || "__no_server__";
  const existing = stores.get(key);
  if (existing) return existing;

  const loadedById = reactive<Record<string, LoadedPluginModule>>({});
  const runtimeById = reactive<Record<string, PluginRuntimeEntry>>({});
  const bindingByDomain = reactive<Record<string, DomainBinding>>({});
  const loading = ref(false);
  const error = ref("");

  let hostBridge: DomainRegistryHostBridge | null = null;

  /**
   * Build a plugin context for the given runtime entry.
   *
   * @param runtime - Runtime entry.
   * @param plugin - Loaded plugin module.
   * @returns PluginContext.
   */
  function buildPluginContext(runtime: PluginRuntimeEntry, plugin: LoadedPluginModule): PluginContext {
    const socket = key === "__no_server__" ? "" : key;
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
   * Register domain bindings from a loaded plugin module.
   *
   * @param plugin - Loaded module.
   * @returns void
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
   * Unregister all bindings for a plugin.
   *
   * @param pluginId - Plugin id.
   * @returns void
   */
  function unregisterPluginDomains(pluginId: string): void {
    for (const k of Object.keys(bindingByDomain)) {
      if (bindingByDomain[k]?.pluginId === pluginId) delete bindingByDomain[k];
    }
  }

  /**
   * Load a plugin module for a runtime entry.
   *
   * @param runtime - Runtime entry.
   * @returns Loaded plugin module.
   */
  async function loadFromRuntime(runtime: PluginRuntimeEntry): Promise<LoadedPluginModule> {
    const entryUrl = toAppPluginEntryUrl(runtime);
    const mod = await importPluginModule(entryUrl);
    return normalizePluginModule(runtime.pluginId, runtime.version, runtime, mod);
  }

  /**
   * Attempt to load a specific installed version (does not mutate installed state).
   *
   * Used by atomic update/switch flows: validate and prepare before switching current.
   *
   * @param pluginId - Plugin id.
   * @param version - Target version.
   * @returns Loaded plugin module.
   */
  async function tryLoadVersion(pluginId: string, version: string): Promise<LoadedPluginModule> {
    if (USE_MOCK_API) throw new Error("tryLoadVersion is not supported in mock mode");
    const runtime = await getRuntimeEntryForVersion(key, pluginId, version);
    return loadFromRuntime(runtime);
  }

  /**
   * Ensure a plugin is loaded and registered (runtime-side).
   *
   * @param pluginId - Plugin id.
   * @returns Promise<void>.
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
      logger.error("Plugin activate failed", { key, pluginId: id, error: String(e) });
      // Activation failure should not crash host UI; plugin stays registered but may be unusable.
    }
  }

  /**
   * Disable a plugin runtime (unregister and call deactivate if present).
   *
   * @param pluginId - Plugin id.
   * @returns Promise<void>.
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
      logger.error("Plugin deactivate failed", { key, pluginId: id, error: String(e) });
    }
  }

  /**
   * Get a fresh plugin context for the current channel/user selection.
   *
   * Note:
   * - The returned `cid` is derived from `currentChannelId.value` at call time.
   *
   * @param pluginId - Plugin id.
   * @returns PluginContext or `null` when not loaded.
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
   * Get a fresh plugin context for a domain.
   *
   * @param domain - Domain string (e.g. `Math:Formula`).
   * @returns PluginContext or `null` when not loaded.
   */
  function getContextForDomain(domain: string): PluginContext | null {
    const d = String(domain ?? "").trim();
    if (!d) return null;
    const binding = bindingByDomain[d] ?? null;
    if (!binding) return null;
    return getContextForPlugin(binding.pluginId);
  }

  /**
   * Set the host bridge for sending messages and reading chat context.
   *
   * This method intentionally lives in the presentation store to avoid a static
   * import cycle between the plugin runtime registry and the chat store facade.
   *
   * @param bridge - Host bridge, or `null` to detach.
   * @returns void
   */
  function setHostBridge(bridge: DomainRegistryHostBridge | null): void {
    hostBridge = bridge;
  }

  /**
   * Ensure all enabled plugins are loaded (best-effort).
   *
   * @returns Promise<void>.
   */
  async function ensureLoaded(): Promise<void> {
    if (USE_MOCK_API) return;
    if (key === "__no_server__") return;
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
          logger.error("Plugin runtime load failed; marking failed", { key, pluginId: st.pluginId, error: msg });
          try {
            await getPluginManagerPort().setFailed(key, st.pluginId, msg);
          } catch (se) {
            logger.error("Mark failed failed", { key, pluginId: st.pluginId, error: String(se) });
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
      logger.error("Ensure loaded failed", { key, error: String(e) });
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
