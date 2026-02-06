/**
 * @fileoverview mockPluginState.ts
 * @description Mock 支撑：mockPluginState（用于本地预览/测试）。
 */

import { readJson, writeJson } from "@/shared/utils/localStore";
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
