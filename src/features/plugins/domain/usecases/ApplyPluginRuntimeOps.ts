/**
 * @fileoverview ApplyPluginRuntimeOps.ts
 * @description plugins｜用例：ApplyPluginRuntimeOps。
 */

import type { InstalledPluginState, PluginCatalogEntry, PluginProgress } from "../types/pluginTypes";
import type { PluginManagerPort } from "../ports/PluginManagerPort";

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
  plugin: PluginCatalogEntry;
  latestVersion: string;
  before: InstalledPluginState | null;
  onProgress?: (p: PluginProgress) => void;
  onState: (state: InstalledPluginState) => void;
  setProgress: (p: PluginProgress) => void;
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
  onState: (state: InstalledPluginState) => void;
  setProgress: (p: PluginProgress) => void;
};

/**
 * 用例输入：回滚版本。
 */
export type RollbackInput = {
  serverSocket: string;
  pluginId: string;
  before: InstalledPluginState | null;
  onProgress?: (p: PluginProgress) => void;
  onState: (state: InstalledPluginState) => void;
  setProgress: (p: PluginProgress) => void;
};

/**
 * 用例输入：启用插件。
 */
export type EnableInput = {
  serverSocket: string;
  pluginId: string;
  onProgress?: (p: PluginProgress) => void;
  onState: (state: InstalledPluginState) => void;
};

/**
 * 用例：插件运行时相关编排（版本切换/更新/启用/回滚）。
 */
export class ApplyPluginRuntimeOps {
  constructor(
    private readonly manager: PluginManagerPort,
    private readonly runtime: PluginRuntimeOpsPort,
  ) {}

  /**
   * 更新到最新版本（含运行时校验与失败回滚）。
   *
   * @param input - 更新输入。
   * @returns 无返回值。
   */
  async updateToLatest(input: UpdateToLatestInput): Promise<void> {
    const id = String(input.plugin?.pluginId ?? "").trim();
    const source = input.plugin?.source ?? "server";
    const v = String(input.latestVersion ?? "").trim();
    if (!id || !v) return;

    const prevVersion = input.before?.currentVersion ?? "";
    const wasEnabled = Boolean(input.before?.enabled && input.before?.status === "ok" && input.before?.currentVersion);

    input.setProgress({ pluginId: id, stage: "downloading", percent: 22, message: "Downloading…" });
    const installed =
      source === "repo"
        ? await this.manager.installFromUrl(
            input.serverSocket,
            id,
            v,
            String(input.plugin.downloadUrl ?? ""),
            String(input.plugin.sha256 ?? ""),
            input.onProgress,
          )
        : await this.manager.install(input.serverSocket, id, v, input.onProgress);
    input.onState(installed);

    if (this.runtime.supported) {
      input.setProgress({ pluginId: id, stage: "unpacking", percent: 60, message: "Validating runtime…" });
      await this.runtime.validateVersion(id, v);
    }

    input.setProgress({ pluginId: id, stage: "switching", percent: 76, message: "Switching version…" });
    const switched = await this.manager.switchVersion(input.serverSocket, id, v, input.onProgress);
    input.onState(switched);

    if (wasEnabled && this.runtime.supported) {
      try {
        await this.runtime.reload(id);
      } catch (e) {
        const reason = String(e) || "Runtime enable failed";
        if (prevVersion) {
          input.setProgress({ pluginId: id, stage: "rolling_back", percent: 88, message: "Rolling back…" });
          const rolled = await this.manager.switchVersion(input.serverSocket, id, prevVersion, input.onProgress);
          input.onState(rolled);
          try {
            await this.runtime.reload(id);
          } catch (re) {
            const finalReason = String(re) || reason;
            const failed = await this.manager.setFailed(input.serverSocket, id, finalReason);
            input.onState(failed);
            throw new Error(finalReason);
          }
          throw new Error(`Update failed; rolled back to ${prevVersion}: ${reason}`);
        }
        const failed = await this.manager.setFailed(input.serverSocket, id, reason);
        input.onState(failed);
        throw new Error(reason);
      }
    }
  }

  /**
   * 切换到目标版本（必要时执行运行时回滚）。
   *
   * @param input - 切换输入。
   * @returns 无返回值。
   */
  async switchVersion(input: SwitchVersionInput): Promise<void> {
    const id = input.pluginId.trim();
    const v = input.version.trim();
    if (!id || !v) return;

    const prev = input.before?.currentVersion ?? "";
    const wasEnabled = Boolean(input.before?.enabled && input.before?.status === "ok" && input.before?.currentVersion);

    if (this.runtime.supported) {
      await this.runtime.validateVersion(id, v);
    }
    const next = await this.manager.switchVersion(input.serverSocket, id, v, input.onProgress);
    input.onState(next);

    if (wasEnabled && this.runtime.supported) {
      try {
        await this.runtime.reload(id);
      } catch (e) {
        if (prev) {
          const rolled = await this.manager.switchVersion(input.serverSocket, id, prev);
          input.onState(rolled);
          await this.runtime.reload(id);
        }
        throw e;
      }
    }
  }

  /**
   * 回滚到上一可用版本。
   *
   * @param input - 回滚输入。
   * @returns 无返回值。
   */
  async rollback(input: RollbackInput): Promise<void> {
    const id = input.pluginId.trim();
    if (!id) return;

    const versions = input.before?.installedVersions ?? [];
    const current = input.before?.currentVersion ?? "";
    const wasEnabled = Boolean(input.before?.enabled && input.before?.status === "ok" && input.before?.currentVersion);
    const prev = versions.find((x) => Boolean(x) && x !== current) ?? "";
    if (!prev) return;

    if (this.runtime.supported) {
      await this.runtime.validateVersion(id, prev);
    }
    const next = await this.manager.switchVersion(input.serverSocket, id, prev, input.onProgress);
    input.onState(next);

    if (wasEnabled && this.runtime.supported) {
      await this.runtime.reload(id);
    }
  }

  /**
   * 启用插件并在需要时加载运行时。
   *
   * @param input - 启用输入。
   * @returns 无返回值。
   */
  async enable(input: EnableInput): Promise<void> {
    const id = input.pluginId.trim();
    if (!id) return;

    const next = await this.manager.enable(input.serverSocket, id, input.onProgress);
    input.onState(next);
    if (!this.runtime.supported) return;

    try {
      await this.runtime.reload(id);
    } catch (e) {
      const msg = String(e) || "Runtime load failed";
      const failed = await this.manager.setFailed(input.serverSocket, id, msg);
      input.onState(failed);
      throw new Error(msg);
    }
  }
}

