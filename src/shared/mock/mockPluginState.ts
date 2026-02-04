/**
 * @fileoverview mockPluginState.ts
 * @description Local mock "installed/enabled" state for plugins, persisted for UI preview.
 */

import { readJson, writeJson } from "@/shared/utils/localStore";
import { MOCK_KEYS } from "./mockKeys";

export type MockInstalledPluginState = {
  installedVersions: string[];
  currentVersion: string | null;
  enabled: boolean;
  status: "ok" | "failed";
  lastError: string;
};

export type MockPluginsState = Record<string, MockInstalledPluginState>;

/**
 * Read mock installed/enabled plugin state for a server.
 *
 * @param serverSocket - Server socket used to namespace local state.
 * @returns Per-plugin mock state map.
 */
export function getMockPluginsState(serverSocket: string): MockPluginsState {
  const key = `${MOCK_KEYS.pluginsStatePrefix}${serverSocket.trim()}`;
  return readJson<MockPluginsState>(key, {});
}

/**
 * Persist mock installed/enabled plugin state for a server.
 *
 * @param serverSocket - Server socket used to namespace local state.
 * @param next - Next per-plugin mock state map.
 */
export function setMockPluginsState(serverSocket: string, next: MockPluginsState): void {
  const key = `${MOCK_KEYS.pluginsStatePrefix}${serverSocket.trim()}`;
  writeJson(key, next);
}
