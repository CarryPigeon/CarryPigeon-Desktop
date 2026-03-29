/**
 * @fileoverview pluginInstallInstallUpdateActions.ts
 * @description plugins｜展示层编排：安装与更新动作集合。
 */

import {
  resolveLatestPluginCatalogVersionEntry,
  resolvePluginCatalogVersionEntry,
  type PluginCatalogEntryLike,
} from "@/features/plugins/domain/types/pluginTypes";
import type {
  PluginInstallActions,
  PluginInstallActionsDeps,
} from "./pluginInstallActionTypes";
import { PLUGIN_INSTALL_OPERATION } from "./pluginInstallOperations";
import { createPluginInstallOperationRunner } from "./pluginInstallOperationRunner";

type PluginInstallInstallUpdateActions = Pick<PluginInstallActions, "install" | "updateToLatest">;

export function createPluginInstallInstallUpdateActions(
  deps: PluginInstallActionsDeps,
): PluginInstallInstallUpdateActions {
  const operationRunner = createPluginInstallOperationRunner(deps);

  async function install(plugin: PluginCatalogEntryLike, version: string): Promise<void> {
    const id = String(plugin?.pluginId ?? "").trim();
    const resolvedVersion =
      resolvePluginCatalogVersionEntry(plugin, version) ?? resolveLatestPluginCatalogVersionEntry(plugin);
    const targetVersion = resolvedVersion?.version ?? String(version ?? "").trim();
    const source = resolvedVersion?.source ?? plugin?.source ?? "server";
    if (!id || !targetVersion) return;

    await operationRunner.run({
      pluginId: id,
      operation: PLUGIN_INSTALL_OPERATION.install,
      async task(onProgress): Promise<void> {
        const next =
          source === "repo"
            ? await deps.commandPort.installFromUrl(
                deps.key,
                id,
                targetVersion,
                String(resolvedVersion?.downloadUrl ?? plugin.downloadUrl ?? ""),
                String(resolvedVersion?.sha256 ?? plugin.sha256 ?? ""),
                onProgress,
              )
            : await deps.commandPort.install(deps.key, id, targetVersion, onProgress);
        deps.installedById[id] = next;
      },
    });
  }

  async function updateToLatest(plugin: PluginCatalogEntryLike, latestVersion: string): Promise<void> {
    const id = String(plugin?.pluginId ?? "").trim();
    const resolved =
      resolvePluginCatalogVersionEntry(plugin, latestVersion) ??
      resolveLatestPluginCatalogVersionEntry(plugin);
    const targetVersion = resolved?.version ?? latestVersion.trim();
    const resolvedPlugin = resolved
      ? {
          ...plugin,
          source: resolved.source,
          downloadUrl: resolved.downloadUrl,
          sha256: resolved.sha256,
        }
      : plugin;
    if (!id || !targetVersion) return;

    await operationRunner.run({
      pluginId: id,
      operation: PLUGIN_INSTALL_OPERATION.update,
      async task(onProgress): Promise<void> {
        const before = deps.installedById[id] ?? (await deps.queryPort.getInstalledState(deps.key, id));
        const next = await deps.runtimeOpsUsecase.updateToLatest({
          serverSocket: deps.key,
          plugin: resolvedPlugin,
          latestVersion: targetVersion,
          before,
          onProgress,
        });
        if (next) deps.installedById[id] = next;
      },
    });
  }

  return {
    install,
    updateToLatest,
  };
}
