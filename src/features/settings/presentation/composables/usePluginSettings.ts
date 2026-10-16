/**
 * @fileoverview usePluginSettings.ts
 * @description settings｜页面编排：读取「当前 server」插件注册的设置项，供设置页「插件设置」分区与搜索使用。
 *
 * 关键约定：
 * - 插件按 server 安装/启用，因此设置项只取当前 server（`normalizeServerKey(currentServerSocket)`）；
 *   无当前 server 时不展示任何插件设置项。
 * - `getPluginsCapabilities()` 必须在函数/computed 内部惰性调用：`plugins/api` 的模块图会反向触达
 *   chat，在模块顶层调用可能命中暂时性死区（TDZ），参见 `chat/data/plugins/chatPluginRuntime.ts`。
 * - 读取的是 store 的响应式投影，因此在 `computed` 中使用可自动跟随插件启停更新。
 */

import { computed, type ComputedRef } from "vue";
import { getPluginsCapabilities } from "@/features/plugins/api";
import type { PluginSettingsContribution } from "@/features/plugins/api-types";
import { currentServerSocket } from "@/features/server-connection/api";
import { isNoServerKey, normalizeServerKey } from "@/shared/serverKey";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("usePluginSettings");

/** 插件设置项分组（按插件聚合，保持注册表顺序）。 */
export type PluginSettingsGroup = {
  pluginId: string;
  items: readonly PluginSettingsContribution[];
};

export type UsePluginSettingsResult = {
  /** 当前 server 的归一化 key（无 server 时为 `__no_server__`）。 */
  socket: ComputedRef<string>;
  /** 当前 server 的插件设置项（注册表顺序）。 */
  items: ComputedRef<readonly PluginSettingsContribution[]>;
  /** 按插件聚合后的分组。 */
  groups: ComputedRef<readonly PluginSettingsGroup[]>;
  /** 触发当前 server 插件运行时加载（幂等；失败只告警，不影响设置页其它功能）。 */
  ensureLoaded(): void;
};

/**
 * 读取当前 server 插件设置项。
 *
 * 说明：`ensureLoaded` 需由调用方在挂载时显式调用（本组合式函数不注册生命周期钩子，
 * 便于脱离组件实例做单测）。
 */
export function usePluginSettings(): UsePluginSettingsResult {
  const socket = computed(() => normalizeServerKey(currentServerSocket.value));

  const items = computed<readonly PluginSettingsContribution[]>(() => {
    const key = socket.value;
    if (isNoServerKey(key)) return [];
    // 惰性读取 capability（见文件头说明）；store 的响应式投影保证插件启停后自动更新。
    return getPluginsCapabilities().forServer(key).listPluginSettingsItems();
  });

  const groups = computed<readonly PluginSettingsGroup[]>(() => {
    const grouped: PluginSettingsGroup[] = [];
    const byPlugin = new Map<string, PluginSettingsContribution[]>();
    for (const item of items.value) {
      const bucket = byPlugin.get(item.pluginId);
      if (bucket) {
        bucket.push(item);
        continue;
      }
      const created = [item];
      byPlugin.set(item.pluginId, created);
      grouped.push({ pluginId: item.pluginId, items: created });
    }
    return grouped;
  });

  function ensureLoaded(): void {
    const key = socket.value;
    if (isNoServerKey(key)) return;
    void getPluginsCapabilities()
      .forServer(key)
      .ensureRuntimeLoaded()
      .catch((error: unknown) => {
        logger.warn("Action: plugins_settings_runtime_load_failed", {
          key,
          error: String(error),
        });
      });
  }

  return { socket, items, groups, ensureLoaded };
}
