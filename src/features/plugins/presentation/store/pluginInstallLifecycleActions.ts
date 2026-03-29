/**
 * @fileoverview pluginInstallLifecycleActions.ts
 * @description plugins｜展示层编排：版本切换/回滚/启停/卸载动作集合。
 */

import type { InstalledPluginState } from "@/features/plugins/domain/types/pluginTypes";
import type {
  PluginInstallActions,
  PluginInstallActionsDeps,
} from "./pluginInstallActionTypes";
import { PLUGIN_INSTALL_OPERATION } from "./pluginInstallOperations";
import { createPluginInstallOperationRunner } from "./pluginInstallOperationRunner";

type PluginInstallLifecycleActions = Pick<
  PluginInstallActions,
  "switchVersion" | "rollback" | "enable" | "disable" | "uninstall"
>;

function resolveRollbackVersion(installed: InstalledPluginState | undefined): string {
  const versions = installed?.installedVersions ?? [];
  const current = installed?.currentVersion ?? "";
  for (const version of versions) {
    if (version && version !== current) return version;
  }
  return "";
}

export function createPluginInstallLifecycleActions(
  deps: PluginInstallActionsDeps,
): PluginInstallLifecycleActions {
  const operationRunner = createPluginInstallOperationRunner(deps);

  async function switchVersion(pluginId: string, version: string): Promise<void> {
    const id = pluginId.trim();
    const targetVersion = version.trim();
    if (!id || !targetVersion) return;

    const before = deps.installedById[id] ?? null;
    await operationRunner.run({
      pluginId: id,
      operation: PLUGIN_INSTALL_OPERATION.switchVersion,
      async task(onProgress): Promise<void> {
        const next = await deps.runtimeOpsUsecase.switchVersion({
          serverSocket: deps.key,
          pluginId: id,
          version: targetVersion,
          before,
          onProgress,
        });
        if (next) deps.installedById[id] = next;
      },
    });
  }

  async function rollback(pluginId: string): Promise<void> {
    const id = pluginId.trim();
    if (!id) return;

    const installed = deps.installedById[id];
    const previousVersion = resolveRollbackVersion(installed);
    if (!previousVersion) return;

    await operationRunner.run({
      pluginId: id,
      operation: PLUGIN_INSTALL_OPERATION.rollback,
      async task(onProgress): Promise<void> {
        const next = await deps.runtimeOpsUsecase.rollback({
          serverSocket: deps.key,
          pluginId: id,
          before: installed,
          onProgress,
        });
        if (next) deps.installedById[id] = next;
      },
    });
  }

  async function enable(pluginId: string): Promise<void> {
    const id = pluginId.trim();
    if (!id) return;

    await operationRunner.run({
      pluginId: id,
      operation: PLUGIN_INSTALL_OPERATION.enable,
      async task(onProgress): Promise<void> {
        const next = await deps.runtimeOpsUsecase.enable({
          serverSocket: deps.key,
          pluginId: id,
          onProgress,
        });
        if (next) deps.installedById[id] = next;
      },
    });
  }

  async function disable(pluginId: string): Promise<void> {
    const id = pluginId.trim();
    if (!id) return;

    await operationRunner.run({
      pluginId: id,
      operation: PLUGIN_INSTALL_OPERATION.disable,
      async task(): Promise<void> {
        const next = await deps.runtimeOpsUsecase.disable({
          serverSocket: deps.key,
          pluginId: id,
        });
        if (next) deps.installedById[id] = next;
      },
    });
  }

  async function uninstall(pluginId: string): Promise<void> {
    const id = pluginId.trim();
    if (!id) return;

    await operationRunner.run({
      pluginId: id,
      operation: PLUGIN_INSTALL_OPERATION.uninstall,
      async task(): Promise<void> {
        await deps.runtimeOpsUsecase.uninstall({
          serverSocket: deps.key,
          pluginId: id,
        });
        delete deps.installedById[id];
      },
    });
  }

  return {
    switchVersion,
    rollback,
    enable,
    disable,
    uninstall,
  };
}
