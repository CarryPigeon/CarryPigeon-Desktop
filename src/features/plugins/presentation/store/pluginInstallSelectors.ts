/**
 * @fileoverview pluginInstallSelectors.ts
 * @description plugins｜展示层编排：安装态读模型与 required 缺失计算。
 */

import type { Ref } from "vue";
import type { InstalledPluginState } from "@/features/plugins/domain/types/pluginTypes";

type CreatePluginInstallSelectorsArgs = {
  installedById: Record<string, InstalledPluginState>;
  missingRequiredIdsRef: Ref<string[]>;
};

type PluginInstallSelectors = {
  recheckRequired(requiredIds: string[]): void;
  isInstalled(pluginId: string): boolean;
  isEnabled(pluginId: string): boolean;
  isFailed(pluginId: string): boolean;
};

/**
 * 创建插件安装态 selectors。
 */
export function createPluginInstallSelectors(
  args: CreatePluginInstallSelectorsArgs,
): PluginInstallSelectors {
  function recheckRequired(requiredIds: string[]): void {
    const missing: string[] = [];
    for (const id of requiredIds) {
      const ok = Boolean(args.installedById[id]?.enabled) && args.installedById[id]?.status === "ok";
      if (!ok) missing.push(id);
    }
    args.missingRequiredIdsRef.value = missing;
  }

  function isInstalled(pluginId: string): boolean {
    return Boolean(args.installedById[pluginId]?.currentVersion);
  }

  function isEnabled(pluginId: string): boolean {
    return Boolean(args.installedById[pluginId]?.enabled && args.installedById[pluginId]?.status === "ok");
  }

  function isFailed(pluginId: string): boolean {
    return Boolean(args.installedById[pluginId]?.status === "failed");
  }

  return {
    recheckRequired,
    isInstalled,
    isEnabled,
    isFailed,
  };
}
