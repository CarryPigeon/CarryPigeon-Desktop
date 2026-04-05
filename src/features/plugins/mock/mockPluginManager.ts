/**
 * @fileoverview mockPluginManager.ts
 * @description plugins｜Mock 实现：mockPluginManager（用于本地预览/测试）。
 */

import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { getMockPluginsState, setMockPluginsState } from "@/shared/mock/mockPluginState";
import { sleep } from "@/shared/mock/sleep";
import type { PluginLifecycleCommandPort } from "@/features/plugins/domain/ports/PluginLifecycleCommandPort";
import type { PluginInstallQueryPort } from "@/features/plugins/domain/ports/PluginInstallQueryPort";
import { createPluginOperationError } from "@/features/plugins/domain/errors/PluginOperationError";
import type { InstalledPluginState, PluginProgressHandler } from "@/features/plugins/domain/types/pluginTypes";

/**
 * 将持久化的 mock 状态转换为领域层的 installed state 结构。
 *
 * @param pluginId - 插件 id。
 * @param raw - 该插件对应的已持久化 mock 状态记录。
 * @returns 已安装状态。
 */
function stateToInstalled(pluginId: string, raw: ReturnType<typeof getMockPluginsState>[string]): InstalledPluginState {
  return {
    pluginId,
    installedVersions: raw?.installedVersions ?? [],
    currentVersion: raw?.currentVersion ?? null,
    enabled: raw?.enabled ?? false,
    status: raw?.status ?? "ok",
    lastError: raw?.lastError ?? "",
  };
}

/**
 * best-effort 的进度触发器（当 handler 缺失时为 no-op）。
 *
 * @param onProgress - 进度回调（可选）。
 * @param payload - 进度载荷。
 */
function emitProgress(onProgress: PluginProgressHandler | undefined, payload: Parameters<PluginProgressHandler>[0]): void {
  if (!onProgress) return;
  onProgress(payload);
}

/**
 * 查询已安装插件列表。
 */
async function listInstalled(serverSocket: string): Promise<InstalledPluginState[]> {
  const raw = getMockPluginsState(serverSocket);
  return Object.keys(raw).map((id) => stateToInstalled(id, raw[id]));
}

/**
 * 查询单个插件安装状态。
 */
async function getInstalledState(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null> {
  const raw = getMockPluginsState(serverSocket);
  if (!raw[pluginId]) return null;
  return stateToInstalled(pluginId, raw[pluginId]);
}

async function install(
  serverSocket: string,
  pluginId: string,
  version: string,
  onProgress?: PluginProgressHandler,
): Promise<InstalledPluginState> {
  const v = version.trim();
  if (!v) throw createPluginOperationError("missing_plugin_version", "Missing version", { pluginId });

  emitProgress(onProgress, { pluginId, stage: "select_version", percent: 8, message: "Select version" });
  await sleep(Math.min(180, MOCK_LATENCY_MS));
  emitProgress(onProgress, { pluginId, stage: "confirm", percent: 14, message: "Confirm install" });
  await sleep(Math.min(220, MOCK_LATENCY_MS));
  emitProgress(onProgress, { pluginId, stage: "downloading", percent: 42, message: "Downloading…" });
  await sleep(Math.max(120, MOCK_LATENCY_MS));
  emitProgress(onProgress, { pluginId, stage: "verifying_sha256", percent: 64, message: "Verifying sha256…" });
  await sleep(Math.max(120, MOCK_LATENCY_MS));
  emitProgress(onProgress, { pluginId, stage: "unpacking", percent: 84, message: "Unpacking…" });
  await sleep(Math.max(120, MOCK_LATENCY_MS));

  const current = getMockPluginsState(serverSocket);
  const prev = current[pluginId];
  const installedVersions = Array.from(new Set([...(prev?.installedVersions ?? []), v]));
  current[pluginId] = {
    installedVersions,
    currentVersion: v,
    enabled: prev?.enabled ?? false,
    status: "ok",
    lastError: "",
  };
  setMockPluginsState(serverSocket, current);

  emitProgress(onProgress, { pluginId, stage: "installed", percent: 100, message: "Installed" });
  return stateToInstalled(pluginId, current[pluginId]);
}

async function installFromUrl(
  serverSocket: string,
  pluginId: string,
  version: string,
  url: string,
  sha256: string,
  onProgress?: PluginProgressHandler,
): Promise<InstalledPluginState> {
  if (!url.trim()) throw createPluginOperationError("missing_download_url", "Missing download url", { pluginId, version });
  if (!sha256.trim()) throw createPluginOperationError("missing_sha256", "Missing sha256", { pluginId, version });
  return install(serverSocket, pluginId, version, onProgress);
}

async function switchVersion(
  serverSocket: string,
  pluginId: string,
  version: string,
  onProgress?: PluginProgressHandler,
): Promise<InstalledPluginState> {
  const v = version.trim();
  if (!v) throw createPluginOperationError("missing_plugin_version", "Missing version", { pluginId });
  const current = getMockPluginsState(serverSocket);
  const prev = current[pluginId];
  if (!prev?.installedVersions?.includes(v)) {
    throw createPluginOperationError("plugin_version_not_installed", "Version not installed", {
      pluginId,
      version: v,
    });
  }

  emitProgress(onProgress, { pluginId, stage: "switching", percent: 34, message: "Switching version…" });
  await sleep(Math.max(140, MOCK_LATENCY_MS));

  current[pluginId] = { ...prev, currentVersion: v, status: "ok", lastError: "" };
  setMockPluginsState(serverSocket, current);
  emitProgress(onProgress, { pluginId, stage: "installed", percent: 100, message: "Switched" });
  return stateToInstalled(pluginId, current[pluginId]);
}

async function enable(serverSocket: string, pluginId: string, onProgress?: PluginProgressHandler): Promise<InstalledPluginState> {
  const current = getMockPluginsState(serverSocket);
  if (!current[pluginId]?.currentVersion) {
    throw createPluginOperationError("plugin_not_installed", "Plugin not installed", { pluginId });
  }

  emitProgress(onProgress, { pluginId, stage: "enabling", percent: 34, message: "Enabling…" });
  await sleep(Math.max(160, MOCK_LATENCY_MS));

  // A small, deterministic failure demo: first enable of a high-permission plugin fails once.
  const failOnceKey = `carrypigeon:mock:pluginFailOnce:${serverSocket.trim()}:${pluginId}`;
  const shouldFailOnce = pluginId === "ext.bridge" && localStorage.getItem(failOnceKey) !== "done";
  if (shouldFailOnce) {
    localStorage.setItem(failOnceKey, "done");
    current[pluginId] = {
      ...current[pluginId],
      enabled: false,
      status: "failed",
      lastError: "Permission audit failed: network/fs requires explicit user approval (mock demo).",
    };
    setMockPluginsState(serverSocket, current);
    emitProgress(onProgress, { pluginId, stage: "failed", percent: 100, message: "Enable failed" });
    return stateToInstalled(pluginId, current[pluginId]);
  }

  current[pluginId] = { ...current[pluginId], enabled: true, status: "ok", lastError: "" };
  setMockPluginsState(serverSocket, current);
  emitProgress(onProgress, { pluginId, stage: "enabled", percent: 100, message: "Enabled" });
  return stateToInstalled(pluginId, current[pluginId]);
}

async function disable(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null> {
  await sleep(Math.min(200, MOCK_LATENCY_MS));
  const current = getMockPluginsState(serverSocket);
  if (!current[pluginId]) return null;
  current[pluginId] = { ...current[pluginId], enabled: false, status: "ok", lastError: "" };
  setMockPluginsState(serverSocket, current);
  return stateToInstalled(pluginId, current[pluginId]);
}

async function setFailed(serverSocket: string, pluginId: string, message: string): Promise<InstalledPluginState> {
  await sleep(Math.min(200, MOCK_LATENCY_MS));
  const msg = String(message ?? "").trim() || "Plugin failed";
  const current = getMockPluginsState(serverSocket);
  if (!current[pluginId]?.currentVersion) {
    throw createPluginOperationError("plugin_not_installed", "Plugin not installed", { pluginId });
  }
  current[pluginId] = { ...current[pluginId], enabled: false, status: "failed", lastError: msg };
  setMockPluginsState(serverSocket, current);
  return stateToInstalled(pluginId, current[pluginId]);
}

async function clearError(serverSocket: string, pluginId: string): Promise<InstalledPluginState> {
  await sleep(Math.min(200, MOCK_LATENCY_MS));
  const current = getMockPluginsState(serverSocket);
  if (!current[pluginId]?.currentVersion) {
    throw createPluginOperationError("plugin_not_installed", "Plugin not installed", { pluginId });
  }
  current[pluginId] = { ...current[pluginId], status: "ok", lastError: "" };
  setMockPluginsState(serverSocket, current);
  return stateToInstalled(pluginId, current[pluginId]);
}

async function uninstall(serverSocket: string, pluginId: string): Promise<void> {
  await sleep(Math.min(220, MOCK_LATENCY_MS));
  const current = getMockPluginsState(serverSocket);
  delete current[pluginId];
  setMockPluginsState(serverSocket, current);
}

/**
 * Mock 查询端口适配器。
 */
export const mockPluginInstallQueryAdapter: PluginInstallQueryPort = {
  listInstalled,
  getInstalledState,
};

/**
 * Mock 命令端口适配器。
 */
export const mockPluginLifecycleCommandAdapter: PluginLifecycleCommandPort = {
  install,
  installFromUrl,
  switchVersion,
  enable,
  disable,
  setFailed,
  clearError,
  uninstall,
};
