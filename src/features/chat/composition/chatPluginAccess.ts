/**
 * @fileoverview chat/pluginAccess integration
 * @description
 * 为 chat feature 提供插件目录摘要与 required-gate 摘要，避免页面直接理解 plugins workspace 全量语义。
 */

import { computed, type ComputedRef } from "vue";
import { getPluginsCapabilities } from "@/features/plugins/api";

const pluginsCapabilities = getPluginsCapabilities();

/**
 * 构建 chat 插件摘要访问层所需的输入。
 */
export type ChatPluginAccessArgs = {
  /**
   * 当前 server socket。
   */
  socket: ComputedRef<string>;
  /**
   * 当前页面/频道声明要求安装的插件列表。
   */
  requiredPluginsDeclared: ComputedRef<readonly string[] | null>;
};

/**
 * quick switcher 消费的插件摘要项。
 */
export type ChatPluginQuickSwitcherEntry = {
  pluginId: string;
  name: string;
};

/**
 * chat 对插件 workspace 的局部读取/刷新访问层。
 *
 * 这个对象是摘要访问层，不是完整的 plugins capability：
 * - 只暴露 chat 真正需要的列表和缺失统计；
 * - 不暴露安装、启用、切版本等插件管理动作。
 */
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
    /**
     * 刷新插件目录摘要。
     */
    refreshCatalog: capabilities.refreshCatalog,
    /**
     * 刷新安装状态并重新校验 required-plugin 缺失情况。
     */
    refreshRequiredPluginsState() {
      return capabilities.refreshInstalledAndRecheck();
    },
  };
}
