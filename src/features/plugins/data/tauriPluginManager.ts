/**
 * @fileoverview Tauri 插件管理器适配器（本地生命周期）。
 * @description plugins｜数据层实现：tauriPluginManager。
 * 将“插件中心”的生命周期操作映射为 Rust 侧的 Tauri commands：
 * - install：从 server catalog 下载 zip → sha256 校验 → 解压安装
 * - enable/disable/switch/uninstall：更新本地状态
 *
 * 说明：
 * - catalog 拉取仍属于 HTTP 层能力，仍由 `httpPluginCatalog.ts` 负责（见 `hybridPluginManager.ts`）。
 * - Rust 侧负责文件系统操作，并通过自定义协议提供 `app://plugins/...` 资源给前端运行时加载。
 *
 * 相关文档：
 * - `design/client/PLUGIN-PACKAGE-STRUCTURE.md`
 * - `design/client/PLUGIN-INSTALL-UPDATE.md`
 * - `design/client/APP-URL-SPEC.md`
 * - `docs/api/*`（`/api/server`, `/api/plugins/catalog`）
 */

import { invokeTauri } from "@/shared/tauri";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { createLogger } from "@/shared/utils/logger";
import { buildTauriTlsArgs } from "@/shared/net/tls/tauriTlsArgs";
import type { PluginManagerPort, PluginProgressHandler } from "@/features/plugins/domain/ports/PluginManagerPort";
import type { InstalledPluginState, PluginCatalogEntry, PluginProgress } from "@/features/plugins/domain/types/pluginTypes";

type RustInstalledPluginState = {
  pluginId: string;
  installedVersions: string[];
  currentVersion: string | null;
  enabled: boolean;
  status: "ok" | "failed" | string;
  lastError: string;
};

const logger = createLogger("tauriPluginManager");

/**
 * 将 Rust 安装态映射为领域层 `InstalledPluginState`。
 *
 * @param raw - Rust 返回值。
 * @returns 领域层安装态。
 */
function mapInstalledState(raw: RustInstalledPluginState): InstalledPluginState {
  return {
    pluginId: String(raw.pluginId ?? "").trim(),
    installedVersions: Array.isArray(raw.installedVersions) ? raw.installedVersions.map((v) => String(v)) : [],
    currentVersion: raw.currentVersion ? String(raw.currentVersion) : null,
    enabled: Boolean(raw.enabled),
    status: raw.status === "failed" ? "failed" : "ok",
    lastError: String(raw.lastError ?? ""),
  };
}

/**
 * 发送一次进度 tick（best-effort）。
 *
 * 后端（Rust）侧目前不流式推送进度事件；这里通过在 await 前后发“粗粒度阶段”，保持 UI 有反馈。
 *
 * @param pluginId - 目标插件 id。
 * @param stage - 进度阶段。
 * @param percent - 进度百分比（0-100）。
 * @param message - 人类可读的进度信息。
 * @param onProgress - 可选 UI 回调。
 */
function emitProgress(
  pluginId: string,
  stage: PluginProgress["stage"],
  percent: number,
  message: string,
  onProgress?: PluginProgressHandler,
): void {
  if (!onProgress) return;
  onProgress({ pluginId, stage, percent, message });
}

/**
 * 桌面端（Tauri）版 `PluginManagerPort` 实现。
 *
 * @constant
 */
export const tauriPluginManager: PluginManagerPort = {
  async listCatalog(serverSocket: string): Promise<PluginCatalogEntry[]> {
    void serverSocket;
    throw new Error("tauriPluginManager 不提供 catalog；请使用 HTTP catalog 适配器。");
  },

  async listInstalled(serverSocket: string): Promise<InstalledPluginState[]> {
    const socket = serverSocket.trim();
    if (!socket) return [];
    const raw = await invokeTauri<RustInstalledPluginState[]>(TAURI_COMMANDS.pluginsListInstalled, { serverSocket: socket, ...buildTauriTlsArgs(socket) });
    return (raw ?? []).map(mapInstalledState).filter((x) => Boolean(x.pluginId));
  },

  async getInstalledState(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null> {
    const socket = serverSocket.trim();
    const id = pluginId.trim();
    if (!socket || !id) return null;
    const raw = await invokeTauri<RustInstalledPluginState | null>(TAURI_COMMANDS.pluginsGetInstalledState, {
      serverSocket: socket,
      pluginId: id,
      ...buildTauriTlsArgs(socket),
    });
    return raw ? mapInstalledState(raw) : null;
  },

  async install(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    const socket = serverSocket.trim();
    const id = pluginId.trim();
    const v = version.trim();
    if (!socket) throw new Error("缺少 server socket");
    if (!id) throw new Error("缺少 plugin id");

    emitProgress(id, "confirm", 0, "准备安装…", onProgress);
    try {
      emitProgress(id, "downloading", 18, "下载中…", onProgress);
      const raw = await invokeTauri<RustInstalledPluginState>(TAURI_COMMANDS.pluginsInstallFromServerCatalog, {
        serverSocket: socket,
        pluginId: id,
        version: v || undefined,
        ...buildTauriTlsArgs(socket),
      });
      emitProgress(id, "installed", 100, "已安装", onProgress);
      return mapInstalledState(raw);
    } catch (e) {
      logger.error("Action: plugins_install_failed", { serverSocket: socket, pluginId: id, version: v, error: String(e) });
      emitProgress(id, "failed", 100, String(e) || "Failed", onProgress);
      throw e;
    }
  },

  async installFromUrl(
    serverSocket: string,
    pluginId: string,
    version: string,
    url: string,
    sha256: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    const socket = serverSocket.trim();
    const id = pluginId.trim();
    const v = version.trim();
    const u = url.trim();
    const sum = sha256.trim();
    if (!socket) throw new Error("缺少 server socket");
    if (!id) throw new Error("缺少 plugin id");
    if (!v) throw new Error("缺少 version");
    if (!u) throw new Error("缺少 download url");
    if (!sum) throw new Error("缺少 sha256");

    emitProgress(id, "confirm", 0, "准备安装…", onProgress);
    try {
      emitProgress(id, "downloading", 18, "下载中…", onProgress);
      emitProgress(id, "verifying_sha256", 44, "校验 sha256…", onProgress);
      emitProgress(id, "unpacking", 70, "解压中…", onProgress);
      const raw = await invokeTauri<RustInstalledPluginState>(TAURI_COMMANDS.pluginsInstallFromUrl, {
        serverSocket: socket,
        pluginId: id,
        version: v,
        url: u,
        sha256: sum,
        ...buildTauriTlsArgs(socket),
      });
      emitProgress(id, "installed", 100, "已安装", onProgress);
      return mapInstalledState(raw);
    } catch (e) {
      logger.error("Action: plugins_install_from_url_failed", { serverSocket: socket, pluginId: id, version: v, url: u, error: String(e) });
      emitProgress(id, "failed", 100, String(e) || "Failed", onProgress);
      throw e;
    }
  },

  async switchVersion(
    serverSocket: string,
    pluginId: string,
    version: string,
    onProgress?: PluginProgressHandler,
  ): Promise<InstalledPluginState> {
    const socket = serverSocket.trim();
    const id = pluginId.trim();
    const v = version.trim();
    if (!socket) throw new Error("缺少 server socket");
    if (!id || !v) throw new Error("缺少 plugin id 或 version");

    emitProgress(id, "switching", 24, "切换版本…", onProgress);
    const raw = await invokeTauri<RustInstalledPluginState>(TAURI_COMMANDS.pluginsSwitchVersion, {
      serverSocket: socket,
      pluginId: id,
      version: v,
      ...buildTauriTlsArgs(socket),
    });
    emitProgress(id, "installed", 100, "已切换", onProgress);
    return mapInstalledState(raw);
  },

  async enable(serverSocket: string, pluginId: string, onProgress?: PluginProgressHandler): Promise<InstalledPluginState> {
    const socket = serverSocket.trim();
    const id = pluginId.trim();
    if (!socket) throw new Error("缺少 server socket");
    if (!id) throw new Error("缺少 plugin id");

    emitProgress(id, "enabling", 30, "启用中…", onProgress);
    const raw = await invokeTauri<RustInstalledPluginState>(TAURI_COMMANDS.pluginsEnable, { serverSocket: socket, pluginId: id, ...buildTauriTlsArgs(socket) });
    emitProgress(id, "enabled", 100, "已启用", onProgress);
    return mapInstalledState(raw);
  },

  async disable(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null> {
    const socket = serverSocket.trim();
    const id = pluginId.trim();
    if (!socket || !id) return null;
    const raw = await invokeTauri<RustInstalledPluginState>(TAURI_COMMANDS.pluginsDisable, { serverSocket: socket, pluginId: id, ...buildTauriTlsArgs(socket) });
    return mapInstalledState(raw);
  },

  async setFailed(serverSocket: string, pluginId: string, message: string): Promise<InstalledPluginState> {
    const socket = serverSocket.trim();
    const id = pluginId.trim();
    const msg = String(message ?? "").trim();
    if (!socket) throw new Error("缺少 server socket");
    if (!id) throw new Error("缺少 plugin id");
    const raw = await invokeTauri<RustInstalledPluginState>(TAURI_COMMANDS.pluginsSetFailed, {
      serverSocket: socket,
      pluginId: id,
      message: msg || "插件失败",
      ...buildTauriTlsArgs(socket),
    });
    return mapInstalledState(raw);
  },

  async clearError(serverSocket: string, pluginId: string): Promise<InstalledPluginState> {
    const socket = serverSocket.trim();
    const id = pluginId.trim();
    if (!socket) throw new Error("缺少 server socket");
    if (!id) throw new Error("缺少 plugin id");
    const raw = await invokeTauri<RustInstalledPluginState>(TAURI_COMMANDS.pluginsClearError, { serverSocket: socket, pluginId: id, ...buildTauriTlsArgs(socket) });
    return mapInstalledState(raw);
  },

  async uninstall(serverSocket: string, pluginId: string): Promise<void> {
    const socket = serverSocket.trim();
    const id = pluginId.trim();
    if (!socket || !id) return;
    await invokeTauri<void>(TAURI_COMMANDS.pluginsUninstall, { serverSocket: socket, pluginId: id, ...buildTauriTlsArgs(socket) });
  },
};
