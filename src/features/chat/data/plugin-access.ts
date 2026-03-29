/**
 * @fileoverview chat/pluginAccess integration
 * @description
 * 为 chat feature 提供插件目录摘要与 required-gate 摘要，避免页面直接理解 plugins workspace 全量语义。
 */

import { computed, type ComputedRef } from "vue";
import { getPluginsCapabilities } from "@/features/plugins/api";

const pluginsCapabilities = getPluginsCapabilities();

export type ChatPluginAccessArgs = {
  socket: ComputedRef<string>;
  requiredPluginsDeclared: ComputedRef<readonly string[] | null>;
};

export type ChatPluginQuickSwitcherEntry = {
  pluginId: string;
  name: string;
};

export type ChatPluginAccess = {
  quickSwitcherModules: ComputedRef<readonly ChatPluginQuickSwitcherEntry[]>;
  requiredPluginIds: ComputedRef<readonly string[]>;
  missingRequiredCount: ComputedRef<number>;
  hasMissingRequiredPlugins: ComputedRef<boolean>;
  refreshCatalog(): Promise<void>;
  refreshRequiredPluginsState(): Promise<void>;
};

/**
 * 构建 chat 可消费的插件摘要访问层。
 */
export function createChatPluginAccess(args: ChatPluginAccessArgs): ChatPluginAccess {
  const capabilities = pluginsCapabilities.workspace.createCapabilities({
    getServerSocket: () => args.socket.value,
    getRequiredPluginIds: () => args.requiredPluginsDeclared.value,
  });
  const snapshot = computed(() => capabilities.getSnapshot());

  const requiredPluginIds = computed(() => snapshot.value.requiredIds);
  const quickSwitcherModules = computed<readonly ChatPluginQuickSwitcherEntry[]>(() =>
    snapshot.value.catalog.map((plugin) => ({
      pluginId: plugin.pluginId,
      name: plugin.name,
    })),
  );
  const missingRequiredCount = computed(() => {
    let missing = 0;
    for (const pluginId of requiredPluginIds.value) {
      const installed = snapshot.value.installedById[pluginId];
      const ready = Boolean(installed?.enabled) && installed?.status === "ok";
      if (!ready) missing += 1;
    }
    return missing;
  });

  return {
    quickSwitcherModules,
    requiredPluginIds,
    missingRequiredCount,
    hasMissingRequiredPlugins: computed(() => missingRequiredCount.value > 0),
    refreshCatalog: capabilities.refreshCatalog,
    refreshRequiredPluginsState() {
      return capabilities.refreshInstalledAndRecheck();
    },
  };
}
