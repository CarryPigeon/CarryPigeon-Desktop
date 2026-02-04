/**
 * @fileoverview pluginInstallStore.ts
 * @description Presentation store: installed/enabled/progress states (per server).
 *
 * Responsibilities (presentation layer):
 * - Track installed plugins and their enablement status for a server.
 * - Track in-flight progress (install/enable/update/switch/rollback) for UI.
 * - Provide convenience predicates (`isInstalled`/`isEnabled`/`isFailed`).
 *
 * Clean Architecture note:
 * The store talks to the domain via `PluginManagerPort` (DI) so that we can
 * swap implementations (mock vs Tauri commands) without changing UI code.
 */

import { computed, reactive, ref, type Ref } from "vue";
import { getPluginManagerPort } from "@/features/plugins/di/plugins.di";
import type { InstalledPluginState, PluginCatalogEntry, PluginProgress } from "@/features/plugins/domain/types/pluginTypes";
import { createLogger } from "@/shared/utils/logger";
import { USE_MOCK_API } from "@/shared/config/runtime";
import { useDomainRegistryStore } from "@/features/plugins/presentation/store/domainRegistryStore";

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
 * Get (or create) a per-server install store.
 *
 * - Stores are keyed by `serverSocket.trim()`.
 * - Empty socket uses `"__no_server__"` so UI preview can still work.
 *
 * @param serverSocket - Current server socket.
 * @returns The stable store instance for that server.
 */
export function usePluginInstallStore(serverSocket: string): InstallStore {
  const key = serverSocket.trim() || "__no_server__";
  const existing = stores.get(key);
  if (existing) return existing;

  const installedById = reactive<Record<string, InstalledPluginState>>({});
  const progressById = reactive<Record<string, PluginProgress | null>>({});
  const busyIdsRef = ref<Set<string>>(new Set());
  const missingRequiredIds = ref<string[]>([]);
  const runtimeSupported = !USE_MOCK_API && key !== "__no_server__";
  const domainRegistry = runtimeSupported ? useDomainRegistryStore(key) : null;

  /**
   * Mark a plugin as "busy" (an operation is in progress) for UI disabling.
   *
   * Implementation detail:
   * We replace the Set instance so Vue can observe the change.
   *
   * @param pluginId - Target plugin id.
   * @param busy - Whether the plugin should be considered busy.
   */
  function setBusy(pluginId: string, busy: boolean): void {
    const next = new Set(busyIdsRef.value);
    if (busy) next.add(pluginId);
    else next.delete(pluginId);
    busyIdsRef.value = next;
  }

  /**
   * Create a progress handler that writes progress into `progressById[targetId]`.
   *
   * This factory avoids inline arrow callbacks so the code stays “code as docs”
   * and keeps the handler strongly associated with a specific `pluginId`.
   *
   * @param targetId - Target plugin id.
   * @returns Progress handler function.
   */
  function createProgressHandler(targetId: string): (p: PluginProgress) => void {
    /**
     * Handle progress updates emitted by the backend operation.
     *
     * @param p - Progress payload.
     * @returns void
     */
    function handleProgress(p: PluginProgress): void {
      progressById[targetId] = p;
    }
    return handleProgress;
  }

  /**
   * Create a timeout callback that clears `progressById[targetId]` when not busy.
   *
   * @param targetId - Target plugin id.
   * @returns Timeout callback.
   */
  function createClearProgressHandler(targetId: string): () => void {
    /**
     * Clear progress UI when no other operation is running for this plugin.
     *
     * @returns void
     */
    function handleClear(): void {
      if (!busyIdsRef.value.has(targetId)) progressById[targetId] = null;
    }
    return handleClear;
  }

  /**
   * Schedule progress UI to clear after a small delay.
   *
   * The delay prevents flicker when operations complete quickly and gives
   * users time to perceive the success state.
   *
   * @param targetId - Target plugin id.
   * @returns void
   */
  function scheduleProgressClear(targetId: string): void {
    window.setTimeout(createClearProgressHandler(targetId), 900);
  }

  /**
   * Validate that a target version can be dynamically imported by the runtime.
   *
   * @param pluginId - Plugin id.
   * @param version - Installed version to validate.
   * @returns Promise<void>
   */
  async function validateRuntimeVersion(pluginId: string, version: string): Promise<void> {
    if (!domainRegistry) return;
    await domainRegistry.tryLoadVersion(pluginId, version);
  }

  /**
   * Reload plugin runtime for current version (disable + enable).
   *
   * @param pluginId - Plugin id.
   * @returns Promise<void>
   */
  async function reloadRuntime(pluginId: string): Promise<void> {
    if (!domainRegistry) return;
    await domainRegistry.disablePluginRuntime(pluginId);
    await domainRegistry.enablePluginRuntime(pluginId);
  }

  /**
   * Disable plugin runtime (best-effort).
   *
   * @param pluginId - Plugin id.
   * @returns Promise<void>
   */
  async function disableRuntime(pluginId: string): Promise<void> {
    if (!domainRegistry) return;
    await domainRegistry.disablePluginRuntime(pluginId);
  }

  /**
   * Check whether a plugin id exists in the installed list returned by backend.
   *
   * @param list - Backend installed list.
   * @param pluginId - Plugin id to search for.
   * @returns `true` when found.
   */
  function listContainsInstalledId(list: InstalledPluginState[], pluginId: string): boolean {
    for (const x of list) {
      if (x.pluginId === pluginId) return true;
    }
    return false;
  }

  /**
   * Refresh installed plugins from backend and reconcile local cache.
   *
   * Behavior:
   * - Updates `installedById` entries found in the backend list.
   * - Removes entries that are no longer present.
   *
   * @returns Promise<void>
   */
  async function refreshInstalled(): Promise<void> {
    try {
      const list = await getPluginManagerPort().listInstalled(key);
      for (const item of list) installedById[item.pluginId] = item;
      for (const id of Object.keys(installedById)) {
        if (!listContainsInstalledId(list, id)) delete installedById[id];
      }
    } catch (e) {
      logger.error("List installed failed", { key, error: String(e) });
    }
  }

  /**
   * Install a plugin version.
   *
   * UI contract:
   * - Sets `progressById[pluginId]` during the operation (so cards/drawers can show progress).
   * - Clears progress shortly after completion (unless another op started).
   * - On failure, keeps/refreshes the last known installed state.
   *
   * @param plugin - Catalog entry (used to decide install source).
   * @param version - Target version to install.
   * @returns Promise<void>
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
      logger.error("Install failed", { key, pluginId: id, error: String(e) });
      progressById[id] = { pluginId: id, stage: "failed", percent: 100, message: String(e) || "Failed" };
      const existing = await getPluginManagerPort().getInstalledState(key, id);
      if (existing) installedById[id] = existing;
    } finally {
      setBusy(id, false);
      scheduleProgressClear(id);
    }
  }

  /**
   * Update a plugin to the given latest version.
   *
   * Behavior:
   * - Installs the target version (does not switch current selection yet).
   * - Validates that the new version can be dynamically imported.
   * - Switches current version to the new one.
   * - If the plugin was enabled, reloads runtime; on failure, auto-rolls back.
   *
   * @param plugin - Catalog entry (used to decide install source).
   * @param latestVersion - Version to update to (usually the catalog's newest).
   * @returns Promise<void>
   */
  async function updateToLatest(plugin: PluginCatalogEntry, latestVersion: string): Promise<void> {
    const id = String(plugin?.pluginId ?? "").trim();
    const source = plugin?.source ?? "server";
    const v = latestVersion.trim();
    if (!id || !v) return;
    const onProgress = createProgressHandler(id);
    setBusy(id, true);
    progressById[id] = { pluginId: id, stage: "checking_updates", percent: 10, message: "Checking updates…" };
    try {
      const before = installedById[id] ?? (await getPluginManagerPort().getInstalledState(key, id));
      const prevVersion = before?.currentVersion ?? "";
      const wasEnabled = Boolean(before?.enabled && before?.status === "ok" && before?.currentVersion);

      progressById[id] = { pluginId: id, stage: "downloading", percent: 22, message: "Downloading…" };
      const installed =
        source === "repo"
          ? await getPluginManagerPort().installFromUrl(
              key,
              id,
              v,
              String(plugin.downloadUrl ?? ""),
              String(plugin.sha256 ?? ""),
              onProgress,
            )
          : await getPluginManagerPort().install(key, id, v, onProgress);
      installedById[id] = installed;

      // Validate the new version can be loaded before switching current selection.
      if (runtimeSupported) {
        progressById[id] = { pluginId: id, stage: "unpacking", percent: 60, message: "Validating runtime…" };
        await validateRuntimeVersion(id, v);
      }

      progressById[id] = { pluginId: id, stage: "switching", percent: 76, message: "Switching version…" };
      const switched = await getPluginManagerPort().switchVersion(key, id, v, onProgress);
      installedById[id] = switched;

      // If it was enabled, reload the runtime and rollback on failure.
      if (wasEnabled && runtimeSupported) {
        try {
          await reloadRuntime(id);
        } catch (e) {
          const reason = String(e) || "Runtime enable failed";
          logger.error("Update enable failed; attempting rollback", { key, pluginId: id, version: v, prevVersion, error: reason });
          if (prevVersion) {
            progressById[id] = { pluginId: id, stage: "rolling_back", percent: 88, message: "Rolling back…" };
            const rolled = await getPluginManagerPort().switchVersion(key, id, prevVersion, onProgress);
            installedById[id] = rolled;
            try {
              await reloadRuntime(id);
            } catch (re) {
              const finalReason = String(re) || reason;
              const failed = await getPluginManagerPort().setFailed(key, id, finalReason);
              installedById[id] = failed;
              throw new Error(finalReason);
            }
            throw new Error(`Update failed; rolled back to ${prevVersion}: ${reason}`);
          }
          const failed = await getPluginManagerPort().setFailed(key, id, reason);
          installedById[id] = failed;
          throw new Error(reason);
        }
      }
    } catch (e) {
      logger.error("Update failed", { key, pluginId: id, error: String(e) });
      progressById[id] = { pluginId: id, stage: "failed", percent: 100, message: String(e) || "Failed" };
      const existing = await getPluginManagerPort().getInstalledState(key, id);
      if (existing) installedById[id] = existing;
    } finally {
      setBusy(id, false);
      scheduleProgressClear(id);
    }
  }

  /**
   * Switch the currently active version of an already-installed plugin.
   *
   * @param pluginId - Plugin identifier.
   * @param version - Target installed version to activate.
   * @returns Promise<void>
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
      if (runtimeSupported) {
        await validateRuntimeVersion(id, v);
      }
      const next = await getPluginManagerPort().switchVersion(key, id, v, onProgress);
      installedById[id] = next;
      if (wasEnabled && runtimeSupported) {
        await reloadRuntime(id);
      }
    } catch (e) {
      logger.error("Switch version failed", { key, pluginId: id, error: String(e) });
      progressById[id] = { pluginId: id, stage: "failed", percent: 100, message: String(e) || "Failed" };
      if (wasEnabled && prev && runtimeSupported) {
        try {
          const rolled = await getPluginManagerPort().switchVersion(key, id, prev);
          installedById[id] = rolled;
          await reloadRuntime(id);
        } catch (re) {
          logger.error("Switch rollback failed", { key, pluginId: id, error: String(re) });
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
   * Roll back to a previous installed version (simple "pick a different version" strategy).
   *
   * Current strategy:
   * - Choose the first installed version that differs from `currentVersion`.
   * - If the plugin is currently enabled, re-enable after switching to keep it on.
   *
   * @param pluginId - Plugin identifier.
   * @returns Promise<void>
   */
  async function rollback(pluginId: string): Promise<void> {
    const id = pluginId.trim();
    if (!id) return;
    const installed = installedById[id];
    const versions = installed?.installedVersions ?? [];
    const current = installed?.currentVersion ?? "";
    const wasEnabled = Boolean(installed?.enabled && installed?.status === "ok" && installed?.currentVersion);
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
      if (runtimeSupported) {
        await validateRuntimeVersion(id, prev);
      }
      const onProgress = createProgressHandler(id);
      const next = await getPluginManagerPort().switchVersion(key, id, prev, onProgress);
      installedById[id] = next;
      if (wasEnabled && runtimeSupported) {
        await reloadRuntime(id);
      }
    } catch (e) {
      logger.error("Rollback failed", { key, pluginId: id, error: String(e) });
      progressById[id] = { pluginId: id, stage: "failed", percent: 100, message: String(e) || "Failed" };
      const existing = await getPluginManagerPort().getInstalledState(key, id);
      if (existing) installedById[id] = existing;
    } finally {
      setBusy(id, false);
      scheduleProgressClear(id);
    }
  }

  /**
   * Enable a plugin (power it on).
   *
   * @param pluginId - Plugin identifier.
   * @returns Promise<void>
   */
  async function enable(pluginId: string): Promise<void> {
    const id = pluginId.trim();
    if (!id) return;
    const onProgress = createProgressHandler(id);
    setBusy(id, true);
    progressById[id] = { pluginId: id, stage: "enabling", percent: 18, message: "Enabling…" };
    try {
      const next = await getPluginManagerPort().enable(key, id, onProgress);
      installedById[id] = next;
      if (runtimeSupported && domainRegistry) {
        try {
          await domainRegistry.enablePluginRuntime(id);
        } catch (e) {
          const msg = String(e) || "Runtime load failed";
          const failed = await getPluginManagerPort().setFailed(key, id, msg);
          installedById[id] = failed;
          throw new Error(msg);
        }
      }
    } catch (e) {
      logger.error("Enable failed", { key, pluginId: id, error: String(e) });
      progressById[id] = { pluginId: id, stage: "failed", percent: 100, message: String(e) || "Failed" };
      const existing = await getPluginManagerPort().getInstalledState(key, id);
      if (existing) installedById[id] = existing;
    } finally {
      setBusy(id, false);
      scheduleProgressClear(id);
    }
  }

  /**
   * Disable a plugin (power it off).
   *
   * @param pluginId - Plugin identifier.
   * @returns Promise<void>
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
      logger.error("Disable failed", { key, pluginId: id, error: String(e) });
    } finally {
      setBusy(id, false);
    }
  }

  /**
   * Uninstall a plugin completely from the local machine for this server context.
   *
   * @param pluginId - Plugin identifier.
   * @returns Promise<void>
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
      logger.error("Uninstall failed", { key, pluginId: id, error: String(e) });
    } finally {
      setBusy(id, false);
    }
  }

  /**
   * Recompute "missing required plugins" from a list of required plugin ids.
   *
   * This drives UI gates such as `/required-setup`.
   *
   * @param requiredIds - Plugin ids that the server marks as required.
   * @returns void
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
   * @param pluginId - Plugin identifier.
   * @returns `true` if the plugin has any installed current version.
   */
  function isInstalled(pluginId: string): boolean {
    return Boolean(installedById[pluginId]?.currentVersion);
  }

  /**
   * @param pluginId - Plugin identifier.
   * @returns `true` if the plugin is enabled and its status is OK.
   */
  function isEnabled(pluginId: string): boolean {
    return Boolean(installedById[pluginId]?.enabled && installedById[pluginId]?.status === "ok");
  }

  /**
   * @param pluginId - Plugin identifier.
   * @returns `true` if the last enable/boot status is failed.
   */
  function isFailed(pluginId: string): boolean {
    return Boolean(installedById[pluginId]?.status === "failed");
  }

  /**
   * Expose the current busy-id set as a computed ref.
   *
   * @returns Busy id set.
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
