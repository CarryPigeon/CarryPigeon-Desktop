/**
 * @fileoverview mockPluginState.ts
 * @description Mock 支撑：mockPluginState（用于本地预览/测试）。
 */

import { readJson, writeJson } from "@/shared/utils/localStore";
import { MOCK_PLUGIN_CATALOG } from "./mockPluginCatalog";
import { MOCK_KEYS } from "./mockKeys";

/**
 * mock 已安装插件状态条目（按 pluginId 聚合）。
 */
export type MockInstalledPluginState = {
  installedVersions: string[];
  currentVersion: string | null;
  enabled: boolean;
  status: "ok" | "failed";
  lastError: string;
};

/**
 * mock 插件状态映射表：pluginId -> MockInstalledPluginState。
 */
export type MockPluginsState = Record<string, MockInstalledPluginState>;

/**
 * 读取某个服务器下的 mock 插件安装/启用状态。
 *
 * @param serverSocket - 服务器 Socket 地址（用于 localStorage 命名空间隔离）。
 * @returns 按插件 id 聚合的 mock 状态映射表。
 */
export function getMockPluginsState(serverSocket: string): MockPluginsState {
  const key = `${MOCK_KEYS.pluginsStatePrefix}${serverSocket.trim()}`;
  return readJson<MockPluginsState>(key, {});
}

/**
 * 持久化某个服务器下的 mock 插件安装/启用状态。
 *
 * @param serverSocket - 服务器 Socket 地址（用于 localStorage 命名空间隔离）。
 * @param next - 下一份按插件 id 聚合的 mock 状态映射表。
 */
export function setMockPluginsState(serverSocket: string, next: MockPluginsState): void {
  const key = `${MOCK_KEYS.pluginsStatePrefix}${serverSocket.trim()}`;
  writeJson(key, next);
}

/**
 * 清除某个服务器下的 mock 插件状态。
 *
 * @param serverSocket - 服务器 Socket 地址（用于 localStorage 命名空间隔离）。
 */
export function clearMockPluginsState(serverSocket: string): void {
  const key = `${MOCK_KEYS.pluginsStatePrefix}${serverSocket.trim()}`;
  localStorage.removeItem(key);
  // 一并清除该服务器的默认启用 marker，使 clear 后默认插件可重新补齐。
  const markerPrefix = defaultEnabledMarkerKey(serverSocket, "");
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith(markerPrefix)) localStorage.removeItem(k);
  }
}

/**
 * 默认启用补齐的 marker key（按服务器 + 插件 id 隔离）。
 *
 * 说明：marker 用于保证补齐只发生一次——用户此后显式 disable/uninstall
 * 不会被“无条目即补齐”的逻辑反复覆盖。
 */
function defaultEnabledMarkerKey(serverSocket: string, pluginId: string): string {
  return `carrypigeon:mock:pluginDefaultEnabled:${serverSocket.trim()}:${pluginId}`;
}

/**
 * 为“默认启用”的插件幂等补齐 installed+enabled 状态。
 *
 * 规则：
 * - 仅当该插件“无任何已安装状态条目”且“补齐 marker 未写入”时补齐；
 * - 补齐时同时写入 marker；此后 disable/uninstall 均不会被覆盖；
 * - 版本取 mock catalog 中该插件的最新版本（无条目时退化为 "0.1.0"）。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @param pluginIds - 需要默认启用的插件 id 列表。
 * @returns 是否发生了补齐写入。
 */
export function ensureDefaultEnabledMockPlugins(serverSocket: string, pluginIds: readonly string[]): boolean {
  if (typeof localStorage === "undefined") return false;
  const current = getMockPluginsState(serverSocket);
  let changed = false;
  for (const rawId of pluginIds) {
    const pluginId = String(rawId ?? "").trim();
    if (!pluginId) continue;
    const markerKey = defaultEnabledMarkerKey(serverSocket, pluginId);
    if (current[pluginId] || localStorage.getItem(markerKey) !== null) continue;
    const version =
      MOCK_PLUGIN_CATALOG.find((plugin) => plugin.pluginId === pluginId)?.versions[0] ?? "0.1.0";
    current[pluginId] = {
      installedVersions: [version],
      currentVersion: version,
      enabled: true,
      status: "ok",
      lastError: "",
    };
    localStorage.setItem(markerKey, "applied");
    changed = true;
  }
  if (changed) setMockPluginsState(serverSocket, current);
  return changed;
}
