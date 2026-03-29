/**
 * @fileoverview ApplyPluginRuntimeOps.ts
 * @description plugins｜用例：ApplyPluginRuntimeOps。
 */

import {
  resolveLatestPluginCatalogVersionEntry,
  resolvePluginCatalogVersionEntry,
  type InstalledPluginState,
  type PluginCatalogEntryLike,
  type PluginProgress,
} from "../types/pluginTypes";
import type { PluginLifecycleCommandPort } from "../ports/PluginLifecycleCommandPort";
import { createPluginOperationError } from "../errors/PluginOperationError";

/**
 * 插件运行时操作端口（由展示层 runtime registry 提供）。
 */
export interface PluginRuntimeOpsPort {
  /**
   * 是否支持运行时模块加载。
   */
  readonly supported: boolean;
  /**
   * 预加载并校验某版本可被运行时加载。
   */
  validateVersion(pluginId: string, version: string): Promise<void>;
  /**
   * 重新加载插件运行时（disable + enable）。
   */
  reload(pluginId: string): Promise<void>;
  /**
   * 禁用插件运行时（best-effort）。
   */
  disable(pluginId: string): Promise<void>;
}

/**
 * 用例输入：更新到最新版本。
 */
export type UpdateToLatestInput = {
  serverSocket: string;
  plugin: PluginCatalogEntryLike;
  latestVersion: string;
  before: InstalledPluginState | null;
  onProgress?: (p: PluginProgress) => void;
};

/**
 * 用例输入：切换版本。
 */
export type SwitchVersionInput = {
  serverSocket: string;
  pluginId: string;
  version: string;
  before: InstalledPluginState | null;
  onProgress?: (p: PluginProgress) => void;
};

/**
 * 用例输入：回滚版本。
 */
export type RollbackInput = {
  serverSocket: string;
  pluginId: string;
  before: InstalledPluginState | null;
  onProgress?: (p: PluginProgress) => void;
};

/**
 * 用例输入：启用插件。
 */
export type EnableInput = {
  serverSocket: string;
  pluginId: string;
  onProgress?: (p: PluginProgress) => void;
};

/**
 * 用例输入：禁用插件。
 */
export type DisableInput = {
  serverSocket: string;
  pluginId: string;
};

/**
 * 用例输入：卸载插件。
 */
export type UninstallInput = {
  serverSocket: string;
  pluginId: string;
};

/**
 * 用例：插件运行时相关编排（版本切换/更新/启用/回滚）。
 */
export class ApplyPluginRuntimeOps {
  constructor(
    private readonly commandPort: PluginLifecycleCommandPort,
    private readonly runtime: PluginRuntimeOpsPort,
  ) {}

  private async setFailedAndThrow(
    serverSocket: string,
    pluginId: string,
    reason: unknown,
    code: "runtime_reload_failed" | "runtime_disable_failed" | "plugin_operation_failed" = "plugin_operation_failed",
  ): Promise<never> {
    const message = String(reason) || "Runtime operation failed";
    await this.commandPort.setFailed(serverSocket, pluginId, message);
    throw createPluginOperationError(code, message, { pluginId, serverSocket });
  }

  /**
   * 更新到最新版本（含运行时校验与失败回滚）。
   *
   * @param input - 更新输入。
   * @returns 无返回值。
   */
  async updateToLatest(input: UpdateToLatestInput): Promise<InstalledPluginState | null> {
    const id = String(input.plugin?.pluginId ?? "").trim();
    const resolved = resolvePluginCatalogVersionEntry(input.plugin, input.latestVersion) ?? resolveLatestPluginCatalogVersionEntry(input.plugin);
    const source = resolved?.source ?? input.plugin?.source ?? "server";
    const v = resolved?.version ?? String(input.latestVersion ?? "").trim();
    if (!id || !v) return null;

    const prevVersion = input.before?.currentVersion ?? "";
    const wasEnabled = Boolean(input.before?.enabled && input.before?.status === "ok" && input.before?.currentVersion);

    let installed =
      source === "repo"
        ? await this.commandPort.installFromUrl(
            input.serverSocket,
            id,
            v,
            String(resolved?.downloadUrl ?? input.plugin.downloadUrl ?? ""),
            String(resolved?.sha256 ?? input.plugin.sha256 ?? ""),
            input.onProgress,
          )
        : await this.commandPort.install(input.serverSocket, id, v, input.onProgress);

    if (this.runtime.supported) {
      await this.runtime.validateVersion(id, v);
    }

    let switched = await this.commandPort.switchVersion(input.serverSocket, id, v, input.onProgress);

    if (wasEnabled && this.runtime.supported) {
      try {
        await this.runtime.reload(id);
      } catch (e) {
        const reason = String(e) || "Runtime enable failed";
        if (prevVersion) {
          switched = await this.commandPort.switchVersion(input.serverSocket, id, prevVersion, input.onProgress);
          try {
            await this.runtime.reload(id);
          } catch (re) {
            const finalReason = String(re) || reason;
            await this.commandPort.setFailed(input.serverSocket, id, finalReason);
            throw createPluginOperationError("runtime_reload_failed", finalReason, {
              pluginId: id,
              serverSocket: input.serverSocket,
              version: prevVersion,
            });
          }
          throw createPluginOperationError("runtime_reload_failed", `Update failed; rolled back to ${prevVersion}: ${reason}`, {
            pluginId: id,
            serverSocket: input.serverSocket,
            version: v,
            rollbackVersion: prevVersion,
          });
        }
        await this.commandPort.setFailed(input.serverSocket, id, reason);
        throw createPluginOperationError("runtime_reload_failed", reason, {
          pluginId: id,
          serverSocket: input.serverSocket,
          version: v,
        });
      }
    }
    installed = switched;
    return installed;
  }

  /**
   * 切换到目标版本（必要时执行运行时回滚）。
   *
   * @param input - 切换输入。
   * @returns 无返回值。
   */
  async switchVersion(input: SwitchVersionInput): Promise<InstalledPluginState | null> {
    const id = input.pluginId.trim();
    const v = input.version.trim();
    if (!id || !v) return null;

    const prev = input.before?.currentVersion ?? "";
    const wasEnabled = Boolean(input.before?.enabled && input.before?.status === "ok" && input.before?.currentVersion);

    if (this.runtime.supported) {
      await this.runtime.validateVersion(id, v);
    }
    let next = await this.commandPort.switchVersion(input.serverSocket, id, v, input.onProgress);

    if (wasEnabled && this.runtime.supported) {
      try {
        await this.runtime.reload(id);
      } catch (e) {
        const reason = String(e) || "Runtime reload failed";
        if (prev) {
          try {
            next = await this.commandPort.switchVersion(input.serverSocket, id, prev);
            await this.runtime.reload(id);
          } catch (rollbackError) {
            await this.setFailedAndThrow(input.serverSocket, id, rollbackError);
          }
          throw createPluginOperationError("runtime_reload_failed", `Switch failed; rolled back to ${prev}: ${reason}`, {
            pluginId: id,
            serverSocket: input.serverSocket,
            version: v,
            rollbackVersion: prev,
          });
        }
        await this.setFailedAndThrow(input.serverSocket, id, reason, "runtime_reload_failed");
      }
    }
    return next;
  }

  /**
   * 回滚到上一可用版本。
   *
   * @param input - 回滚输入。
   * @returns 无返回值。
   */
  async rollback(input: RollbackInput): Promise<InstalledPluginState | null> {
    const id = input.pluginId.trim();
    if (!id) return null;

    const versions = input.before?.installedVersions ?? [];
    const current = input.before?.currentVersion ?? "";
    const wasEnabled = Boolean(input.before?.enabled && input.before?.status === "ok" && input.before?.currentVersion);
    const prev = versions.find((x) => Boolean(x) && x !== current) ?? "";
    if (!prev) return null;

    if (this.runtime.supported) {
      await this.runtime.validateVersion(id, prev);
    }
    const next = await this.commandPort.switchVersion(input.serverSocket, id, prev, input.onProgress);

    if (wasEnabled && this.runtime.supported) {
      try {
        await this.runtime.reload(id);
      } catch (e) {
        await this.setFailedAndThrow(input.serverSocket, id, e, "runtime_reload_failed");
      }
    }
    return next;
  }

  /**
   * 启用插件并在需要时加载运行时。
   *
   * @param input - 启用输入。
   * @returns 无返回值。
   */
  async enable(input: EnableInput): Promise<InstalledPluginState | null> {
    const id = input.pluginId.trim();
    if (!id) return null;

    const next = await this.commandPort.enable(input.serverSocket, id, input.onProgress);
    if (!this.runtime.supported) return next;

    try {
      await this.runtime.reload(id);
    } catch (e) {
      const msg = String(e) || "Runtime load failed";
      await this.commandPort.setFailed(input.serverSocket, id, msg);
      throw createPluginOperationError("runtime_reload_failed", msg, {
        pluginId: id,
        serverSocket: input.serverSocket,
      });
    }
    return next;
  }

  /**
   * 禁用插件，并在运行时可用时同步禁用 runtime。
   *
   * @param input - 禁用输入。
   * @returns 更新后的安装态（未安装时返回 null）。
   */
  async disable(input: DisableInput): Promise<InstalledPluginState | null> {
    const id = input.pluginId.trim();
    if (!id) return null;

    const next = await this.commandPort.disable(input.serverSocket, id);
    if (!this.runtime.supported) return next;

    try {
      await this.runtime.disable(id);
    } catch (error) {
      throw createPluginOperationError("runtime_disable_failed", String(error) || "Runtime disable failed", {
        pluginId: id,
        serverSocket: input.serverSocket,
      });
    }
    return next;
  }

  /**
   * 卸载插件，并在运行时可用时先禁用 runtime。
   *
   * @param input - 卸载输入。
   * @returns 无返回值。
   */
  async uninstall(input: UninstallInput): Promise<void> {
    const id = input.pluginId.trim();
    if (!id) return;

    if (this.runtime.supported) {
      try {
        await this.runtime.disable(id);
      } catch (error) {
        throw createPluginOperationError("runtime_disable_failed", String(error) || "Runtime disable failed", {
          pluginId: id,
          serverSocket: input.serverSocket,
        });
      }
    }
    await this.commandPort.uninstall(input.serverSocket, id);
  }
}
