/**
 * @fileoverview domain registry runtime reconciler
 * @description
 * 把“已安装插件状态”和“已加载运行时状态”对齐，避免 registry store 同时承担全部协调职责。
 */

import type { Ref } from "vue";
import { NO_SERVER_KEY } from "@/shared/serverKey";
import type { InstalledPluginState } from "@/features/plugins/domain/types/pluginTypes";
import type { LoadedPluginModule } from "@/features/plugins/presentation/runtime/pluginRuntime";

type LoggerLike = {
  error(message: string, payload?: Record<string, unknown>): void;
};

export type DomainRegistryReconcilerDeps = {
  key: string;
  runtimeLoadingDisabled: boolean;
  loadedById: Record<string, LoadedPluginModule>;
  loading: Ref<boolean>;
  error: Ref<string>;
  logger: LoggerLike;
  listInstalled: () => Promise<InstalledPluginState[]>;
  enablePluginRuntime: (pluginId: string) => Promise<void>;
  disablePluginRuntime: (pluginId: string) => Promise<void>;
  markFailed: (pluginId: string, message: string) => Promise<void>;
  notifyRuntimeStateChanged: () => void;
};

export function createDomainRegistryReconciler(deps: DomainRegistryReconcilerDeps) {
  async function ensureLoaded(): Promise<void> {
    if (deps.runtimeLoadingDisabled) return;
    if (deps.key === NO_SERVER_KEY) return;
    deps.loading.value = true;
    deps.error.value = "";
    try {
      const installed = await deps.listInstalled();
      for (const state of installed) {
        if (!state.enabled || state.status !== "ok") continue;
        if (!state.currentVersion) continue;
        if (deps.loadedById[state.pluginId]?.version === state.currentVersion) continue;
        try {
          await deps.enablePluginRuntime(state.pluginId);
        } catch (error) {
          const message = String(error) || "Runtime load failed";
          deps.logger.error("Action: plugins_runtime_load_failed_mark_failed", {
            key: deps.key,
            pluginId: state.pluginId,
            error: message,
          });
          try {
            await deps.markFailed(state.pluginId, message);
            deps.notifyRuntimeStateChanged();
          } catch (syncError) {
            deps.logger.error("Action: plugins_mark_failed_state_failed", {
              key: deps.key,
              pluginId: state.pluginId,
              error: String(syncError),
            });
          }
        }
      }

      for (const pluginId of Object.keys(deps.loadedById)) {
        const state = installed.find((item) => item.pluginId === pluginId);
        const shouldBeOn = Boolean(state?.enabled && state?.status === "ok" && state?.currentVersion);
        if (!shouldBeOn) await deps.disablePluginRuntime(pluginId);
      }
    } catch (error) {
      deps.error.value = String(error);
      deps.logger.error("Action: plugins_ensure_loaded_failed", {
        key: deps.key,
        error: String(error),
      });
    } finally {
      deps.loading.value = false;
    }
  }

  return { ensureLoaded };
}
