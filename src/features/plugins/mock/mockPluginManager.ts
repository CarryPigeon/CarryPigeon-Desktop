/**
 * @fileoverview mockPluginManager.ts
 * @description plugins｜Mock 实现：mockPluginManager（用于本地预览/测试）。
 */

import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import { getMockPluginsState, setMockPluginsState } from "@/shared/mock/mockPluginState";
import { sleep } from "@/shared/mock/sleep";
import type { PluginManagerPort, PluginProgressHandler } from "@/features/plugins/domain/ports/PluginManagerPort";
import type { InstalledPluginState, PluginCatalogEntry } from "@/features/plugins/domain/types/pluginTypes";

/**
 * 将静态 mock catalog 转换为领域层的 catalog entry 结构。
 *
 * @returns 插件目录条目列表。
 */
function toDomainCatalog(): PluginCatalogEntry[] {
  return MOCK_PLUGIN_CATALOG.map((p) => ({
    pluginId: p.pluginId,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    homepage: p.homepage,
    source: p.source,
    downloadUrl: p.downloadUrl,
    sha256: p.sha256,
    required: p.required,
    versions: p.versions,
    providesDomains: p.providesDomains,
    permissions: p.permissions,
  }));
}

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
 * Mock `PluginManagerPort` implementation.
 *
 * Used for local UI preview when `VITE_USE_MOCK_API=true`.
 *
 * @constant
 */
export const mockPluginManager: PluginManagerPort = {
  async listCatalog(_serverSocket: string): Promise<PluginCatalogEntry[]> {
    void _serverSocket;
    await sleep(Math.min(240, MOCK_LATENCY_MS));
    return toDomainCatalog();
  },
  async listInstalled(serverSocket: string): Promise<InstalledPluginState[]> {
    const raw = getMockPluginsState(serverSocket);
    return Object.keys(raw).map((id) => stateToInstalled(id, raw[id]));
  },
  async getInstalledState(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null> {
    const raw = getMockPluginsState(serverSocket);
    if (!raw[pluginId]) return null;
    return stateToInstalled(pluginId, raw[pluginId]);
  },
  async install(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    const v = version.trim();
    if (!v) throw new Error("Missing version");

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
  },
  async installFromUrl(
    serverSocket: string,
    pluginId: string,
    version: string,
    url: string,
    sha256: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    if (!url.trim()) throw new Error("Missing download url");
    if (!sha256.trim()) throw new Error("Missing sha256");
    return mockPluginManager.install(serverSocket, pluginId, version, onProgress);
  },
  async switchVersion(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    const v = version.trim();
    if (!v) throw new Error("Missing version");
    const current = getMockPluginsState(serverSocket);
    const prev = current[pluginId];
    if (!prev?.installedVersions?.includes(v)) throw new Error("Version not installed");

    emitProgress(onProgress, { pluginId, stage: "switching", percent: 34, message: "Switching version…" });
    await sleep(Math.max(140, MOCK_LATENCY_MS));

    current[pluginId] = { ...prev, currentVersion: v, status: "ok", lastError: "" };
    setMockPluginsState(serverSocket, current);
    emitProgress(onProgress, { pluginId, stage: "installed", percent: 100, message: "Switched" });
    return stateToInstalled(pluginId, current[pluginId]);
  },
  async enable(serverSocket: string, pluginId: string, onProgress?: PluginProgressHandler): Promise<InstalledPluginState> {
    const current = getMockPluginsState(serverSocket);
    if (!current[pluginId]?.currentVersion) throw new Error("Plugin not installed");

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
  },
  async disable(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null> {
    await sleep(Math.min(200, MOCK_LATENCY_MS));
    const current = getMockPluginsState(serverSocket);
    if (!current[pluginId]) return null;
    current[pluginId] = { ...current[pluginId], enabled: false, status: "ok", lastError: "" };
    setMockPluginsState(serverSocket, current);
    return stateToInstalled(pluginId, current[pluginId]);
  },
  async setFailed(serverSocket: string, pluginId: string, message: string): Promise<InstalledPluginState> {
    await sleep(Math.min(200, MOCK_LATENCY_MS));
    const msg = String(message ?? "").trim() || "Plugin failed";
    const current = getMockPluginsState(serverSocket);
    if (!current[pluginId]?.currentVersion) throw new Error("Plugin not installed");
    current[pluginId] = { ...current[pluginId], enabled: false, status: "failed", lastError: msg };
    setMockPluginsState(serverSocket, current);
    return stateToInstalled(pluginId, current[pluginId]);
  },
  async clearError(serverSocket: string, pluginId: string): Promise<InstalledPluginState> {
    await sleep(Math.min(200, MOCK_LATENCY_MS));
    const current = getMockPluginsState(serverSocket);
    if (!current[pluginId]?.currentVersion) throw new Error("Plugin not installed");
    current[pluginId] = { ...current[pluginId], status: "ok", lastError: "" };
    setMockPluginsState(serverSocket, current);
    return stateToInstalled(pluginId, current[pluginId]);
  },
  async uninstall(serverSocket: string, pluginId: string): Promise<void> {
    await sleep(Math.min(220, MOCK_LATENCY_MS));
    const current = getMockPluginsState(serverSocket);
    delete current[pluginId];
    setMockPluginsState(serverSocket, current);
  },
};
