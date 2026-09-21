/**
 * @fileoverview Tauri 插件管理器适配器（本地生命周期）。
 * @description plugins｜数据层实现：tauriPluginManager。
 * 将“插件中心”的生命周期操作映射为 Rust 侧的 Tauri commands：
 * - install：从 server catalog 下载 zip → sha256 校验 → 解压安装
 * - enable/disable/switch/uninstall：更新本地状态
 *
 * 说明：
 * - catalog 拉取仍属于 HTTP 层能力，仍由 `httpPluginCatalog.ts` 负责。
 * - Rust 侧负责文件系统操作，并通过自定义协议提供 `app://plugins/...` 资源给前端运行时加载。
 *
 * 相关文档：
 * - `docs/design/client/PLUGIN-PACKAGE-STRUCTURE.md`
 * - `docs/design/client/PLUGIN-INSTALL-UPDATE.md`
 * - `docs/design/client/APP-URL-SPEC.md`
 * - `docs/api/*`（`/api/server`, `/api/plugins/catalog`）
 */

import { invokeTauri } from "@/shared/tauri";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { createLogger } from "@/shared/utils/logger";
import { buildTauriTlsArgs } from "@/shared/net/tls/tauriTlsArgs";
import type { PluginInstallQueryPort } from "@/features/plugins/domain/ports/PluginInstallQueryPort";
import type { PluginLifecycleCommandPort } from "@/features/plugins/domain/ports/PluginLifecycleCommandPort";
import { createPluginOperationError } from "@/features/plugins/domain/errors/PluginOperationError";
import type { InstalledPluginState, PluginProgress, PluginProgressHandler } from "@/features/plugins/domain/types/pluginTypes";
import {
  getLocalInstalledState,
  isLocalPluginSourceEnabled,
  listLocalDefaultInstalledStates,
  setLocalPluginDisabled,
} from "@/features/plugins/data/localPluginSource";

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
 * 查询已安装插件列表。
 *
 * 说明：dev 本地源模式下，默认启用的本地源插件会被合并进结果
 * （本地源插件不落盘安装，安装态由本地源注册表推导）。
 */
async function listInstalled(serverSocket: string): Promise<InstalledPluginState[]> {
  const socket = serverSocket.trim();
  if (!socket) return [];
  const raw = await invokeTauri<RustInstalledPluginState[]>(TAURI_COMMANDS.pluginsListInstalled, { serverSocket: socket, ...buildTauriTlsArgs(socket) });
  const merged = (raw ?? []).map(mapInstalledState).filter((x) => Boolean(x.pluginId));
  for (const state of listLocalDefaultInstalledStates(socket)) {
    if (!merged.some((x) => x.pluginId === state.pluginId)) merged.push(state);
  }
  return merged;
}

/**
 * 查询单个插件安装状态。
 */
async function getInstalledState(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null> {
  const socket = serverSocket.trim();
  const id = pluginId.trim();
  if (!socket || !id) return null;
  const raw = await invokeTauri<RustInstalledPluginState | null>(TAURI_COMMANDS.pluginsGetInstalledState, {
    serverSocket: socket,
    pluginId: id,
    ...buildTauriTlsArgs(socket),
  });
  if (raw) return mapInstalledState(raw);
  return getLocalInstalledState(socket, id);
}

async function install(
  serverSocket: string,
  pluginId: string,
  version: string,
  onProgress?: PluginProgressHandler,
): Promise<InstalledPluginState> {
  const socket = serverSocket.trim();
  const id = pluginId.trim();
  const v = version.trim();
  if (!socket) throw createPluginOperationError("missing_server_socket", "Missing server socket");
  if (!id) throw createPluginOperationError("missing_plugin_id", "Missing plugin ID");

  // 本地源插件不落盘安装：清除停用标记即视为重新安装启用。
  if (isLocalPluginSourceEnabled(id)) {
    setLocalPluginDisabled(socket, id, false);
    const state = getLocalInstalledState(socket, id);
    if (!state) throw createPluginOperationError("plugin_not_installed", "Local plugin state unavailable", { pluginId: id });
    emitProgress(id, "installed", 100, "Installed", onProgress);
    return state;
  }

  emitProgress(id, "confirm", 0, "Preparing...", onProgress);
  try {
    emitProgress(id, "downloading", 18, "Downloading...", onProgress);
    const raw = await invokeTauri<RustInstalledPluginState>(TAURI_COMMANDS.pluginsInstallFromServerCatalog, {
      serverSocket: socket,
      pluginId: id,
      version: v || undefined,
      ...buildTauriTlsArgs(socket),
    });
    emitProgress(id, "installed", 100, "Installed", onProgress);
    return mapInstalledState(raw);
  } catch (e) {
    logger.error("Action: plugins_install_failed", { serverSocket: socket, pluginId: id, version: v, error: String(e) });
    emitProgress(id, "failed", 100, String(e) || "Failed", onProgress);
    throw e;
  }
}

async function installFromUrl(
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
  if (!socket) throw createPluginOperationError("missing_server_socket", "Missing server socket");
  if (!id) throw createPluginOperationError("missing_plugin_id", "Missing plugin ID");
  if (!v) throw createPluginOperationError("missing_plugin_version", "Missing version", { pluginId: id });
  if (!u) throw createPluginOperationError("missing_download_url", "Missing download URL", { pluginId: id, version: v });
  if (!sum) throw createPluginOperationError("missing_sha256", "Missing SHA256", { pluginId: id, version: v });

  // 本地源插件：委托 install 的本地分支处理。
  if (isLocalPluginSourceEnabled(id)) {
    return install(serverSocket, pluginId, version, onProgress);
  }

  emitProgress(id, "confirm", 0, "Preparing...", onProgress);
  try {
    emitProgress(id, "downloading", 18, "Downloading...", onProgress);
    emitProgress(id, "verifying_sha256", 44, "Verifying SHA256...", onProgress);
    emitProgress(id, "unpacking", 70, "Unpacking...", onProgress);
    const raw = await invokeTauri<RustInstalledPluginState>(TAURI_COMMANDS.pluginsInstallFromUrl, {
      serverSocket: socket,
      pluginId: id,
      version: v,
      url: u,
      sha256: sum,
      ...buildTauriTlsArgs(socket),
    });
    emitProgress(id, "installed", 100, "Installed", onProgress);
    return mapInstalledState(raw);
  } catch (e) {
    logger.error("Action: plugins_install_from_url_failed", { serverSocket: socket, pluginId: id, version: v, url: u, error: String(e) });
    emitProgress(id, "failed", 100, String(e) || "Failed", onProgress);
    throw e;
  }
}

async function switchVersion(
  serverSocket: string,
  pluginId: string,
  version: string,
  onProgress?: PluginProgressHandler,
): Promise<InstalledPluginState> {
  const socket = serverSocket.trim();
  const id = pluginId.trim();
  const v = version.trim();
  if (!socket) throw createPluginOperationError("missing_server_socket", "Missing server socket");
  if (!id) throw createPluginOperationError("missing_plugin_id", "Missing plugin ID");
  if (!v) throw createPluginOperationError("missing_plugin_version", "Missing version", { pluginId: id });

  // 本地源插件仅注册表单版本，切换等同 no-op。
  if (isLocalPluginSourceEnabled(id)) {
    emitProgress(id, "switching", 24, "Switching version...", onProgress);
    emitProgress(id, "installed", 100, "Switched", onProgress);
    const state = getLocalInstalledState(socket, id);
    if (!state) throw createPluginOperationError("plugin_not_installed", "Local plugin state unavailable", { pluginId: id });
    return state;
  }

  emitProgress(id, "switching", 24, "Switching version...", onProgress);
  const raw = await invokeTauri<RustInstalledPluginState>(TAURI_COMMANDS.pluginsSwitchVersion, {
    serverSocket: socket,
    pluginId: id,
    version: v,
    ...buildTauriTlsArgs(socket),
  });
  emitProgress(id, "installed", 100, "Switched", onProgress);
  return mapInstalledState(raw);
}

async function enable(serverSocket: string, pluginId: string, onProgress?: PluginProgressHandler): Promise<InstalledPluginState> {
  const socket = serverSocket.trim();
  const id = pluginId.trim();
  if (!socket) throw createPluginOperationError("missing_server_socket", "Missing server socket");
  if (!id) throw createPluginOperationError("missing_plugin_id", "Missing plugin ID");

  // 本地源插件：清除停用标记即启用。
  if (isLocalPluginSourceEnabled(id)) {
    setLocalPluginDisabled(socket, id, false);
    emitProgress(id, "enabling", 30, "Enabling...", onProgress);
    emitProgress(id, "enabled", 100, "Enabled", onProgress);
    const state = getLocalInstalledState(socket, id);
    if (!state) throw createPluginOperationError("plugin_not_installed", "Local plugin state unavailable", { pluginId: id });
    return state;
  }

  emitProgress(id, "enabling", 30, "Enabling...", onProgress);
  const raw = await invokeTauri<RustInstalledPluginState>(TAURI_COMMANDS.pluginsEnable, { serverSocket: socket, pluginId: id, ...buildTauriTlsArgs(socket) });
  emitProgress(id, "enabled", 100, "Enabled", onProgress);
  return mapInstalledState(raw);
}

async function disable(serverSocket: string, pluginId: string): Promise<InstalledPluginState | null> {
  const socket = serverSocket.trim();
  const id = pluginId.trim();
  if (!socket || !id) return null;
  // 本地源插件：写停用标记，不落 Rust。
  if (isLocalPluginSourceEnabled(id)) {
    setLocalPluginDisabled(socket, id, true);
    return getLocalInstalledState(socket, id);
  }
  const raw = await invokeTauri<RustInstalledPluginState>(TAURI_COMMANDS.pluginsDisable, { serverSocket: socket, pluginId: id, ...buildTauriTlsArgs(socket) });
  return mapInstalledState(raw);
}

async function setFailed(serverSocket: string, pluginId: string, message: string): Promise<InstalledPluginState> {
  const socket = serverSocket.trim();
  const id = pluginId.trim();
  const msg = String(message ?? "").trim();
  if (!socket) throw createPluginOperationError("missing_server_socket", "Missing server socket");
  if (!id) throw createPluginOperationError("missing_plugin_id", "Missing plugin ID");
  // 本地源插件未在 Rust 落盘，标记失败态直接在本地合成，避免无效命令报错。
  if (isLocalPluginSourceEnabled(id)) {
    return {
      ...(getLocalInstalledState(socket, id) ?? {
        pluginId: id,
        installedVersions: [],
        currentVersion: null,
        enabled: false,
        status: "ok" as const,
        lastError: "",
      }),
      enabled: false,
      status: "failed",
      lastError: msg || "Plugin failed",
    };
  }
  const raw = await invokeTauri<RustInstalledPluginState>(TAURI_COMMANDS.pluginsSetFailed, {
    serverSocket: socket,
    pluginId: id,
    message: msg || "Plugin failed",
    ...buildTauriTlsArgs(socket),
  });
  return mapInstalledState(raw);
}

async function clearError(serverSocket: string, pluginId: string): Promise<InstalledPluginState> {
  const socket = serverSocket.trim();
  const id = pluginId.trim();
  if (!socket) throw createPluginOperationError("missing_server_socket", "Missing server socket");
  if (!id) throw createPluginOperationError("missing_plugin_id", "Missing plugin ID");
  // 本地源插件：清错等同恢复本地安装态，不落 Rust。
  if (isLocalPluginSourceEnabled(id)) {
    const state = getLocalInstalledState(socket, id);
    if (!state) throw createPluginOperationError("plugin_not_installed", "Local plugin state unavailable", { pluginId: id });
    return state;
  }
  const raw = await invokeTauri<RustInstalledPluginState>(TAURI_COMMANDS.pluginsClearError, { serverSocket: socket, pluginId: id, ...buildTauriTlsArgs(socket) });
  return mapInstalledState(raw);
}

async function uninstall(serverSocket: string, pluginId: string): Promise<void> {
  const socket = serverSocket.trim();
  const id = pluginId.trim();
  if (!socket || !id) return;
  // 本地源插件：写停用标记即视为卸载（不删除 dist 构建产物）。
  if (isLocalPluginSourceEnabled(id)) {
    setLocalPluginDisabled(socket, id, true);
    return;
  }
  await invokeTauri<void>(TAURI_COMMANDS.pluginsUninstall, { serverSocket: socket, pluginId: id, ...buildTauriTlsArgs(socket) });
}

/**
 * 桌面端（Tauri）查询端口适配器。
 */
export const tauriPluginInstallQueryAdapter: PluginInstallQueryPort = {
  listInstalled,
  getInstalledState,
};

/**
 * 桌面端（Tauri）命令端口适配器。
 */
export const tauriPluginLifecycleCommandAdapter: PluginLifecycleCommandPort = {
  install,
  installFromUrl,
  switchVersion,
  enable,
  disable,
  setFailed,
  clearError,
  uninstall,
};
