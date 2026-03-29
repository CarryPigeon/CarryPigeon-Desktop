/**
 * @fileoverview pluginInstallOperationHelpers.ts
 * @description plugins｜展示层编排：插件操作通用执行器（busy/progress/recover）。
 */

import type { Ref } from "vue";
import type { PluginProgress } from "@/features/plugins/domain/types/pluginTypes";
import type { Logger } from "@/shared/utils/logger";
import type { PluginInstallOperation } from "./pluginInstallOperations";

export type BusyPluginOperationArgs = {
  pluginId: string;
  action: PluginInstallOperation;
  initialProgress?: PluginProgress;
  recoverInstalledOnError?: boolean;
  clearProgressAfterDone?: boolean;
  onError?: (error: unknown) => Promise<void> | void;
  task: () => Promise<void>;
};

type CreatePluginOperationHelpersArgs = {
  key: string;
  busyIdsRef: Ref<Set<string>>;
  progressById: Record<string, PluginProgress | null>;
  logger: Logger;
  recoverInstalledState: (pluginId: string) => Promise<void>;
  progressClearDelayMs?: number;
};

type PluginOperationHelpers = {
  createProgressHandler(targetId: string): (progress: PluginProgress) => void;
  setFailedProgress(pluginId: string, error: unknown): void;
  runBusyPluginOperation(args: BusyPluginOperationArgs): Promise<void>;
};

const DEFAULT_PROGRESS_CLEAR_DELAY_MS = 900;

/**
 * 创建插件安装操作辅助器（busy gate / progress 清理 / 失败恢复）。
 */
export function createPluginOperationHelpers(
  args: CreatePluginOperationHelpersArgs,
): PluginOperationHelpers {
  const delayMs = args.progressClearDelayMs ?? DEFAULT_PROGRESS_CLEAR_DELAY_MS;

  function setBusy(pluginId: string, busy: boolean): void {
    const next = new Set(args.busyIdsRef.value);
    if (busy) next.add(pluginId);
    else next.delete(pluginId);
    args.busyIdsRef.value = next;
  }

  function canRun(pluginId: string, action: PluginInstallOperation): boolean {
    if (!args.busyIdsRef.value.has(pluginId)) return true;
    args.logger.warn("Action: plugins_operation_skipped_busy", {
      key: args.key,
      pluginId,
      operation: action,
    });
    return false;
  }

  function createProgressHandler(targetId: string): (progress: PluginProgress) => void {
    return (progress: PluginProgress): void => {
      args.progressById[targetId] = progress;
    };
  }

  function scheduleProgressClear(targetId: string): void {
    window.setTimeout(() => {
      if (!args.busyIdsRef.value.has(targetId)) args.progressById[targetId] = null;
    }, delayMs);
  }

  function setFailedProgress(pluginId: string, error: unknown): void {
    args.progressById[pluginId] = {
      pluginId,
      stage: "failed",
      percent: 100,
      message: String(error) || "Failed",
    };
  }

  async function runBusyPluginOperation(operation: BusyPluginOperationArgs): Promise<void> {
    const id = operation.pluginId.trim();
    if (!id) return;
    if (!canRun(id, operation.action)) return;

    setBusy(id, true);
    if (operation.initialProgress) args.progressById[id] = operation.initialProgress;

    try {
      await operation.task();
    } catch (e) {
      let errorToThrow: unknown = e;
      try {
        if (operation.onError) await operation.onError(e);
      } catch (handlerError) {
        errorToThrow = handlerError;
      }
      if (operation.recoverInstalledOnError) {
        try {
          await args.recoverInstalledState(id);
        } catch (recoverError) {
          args.logger.error("Action: plugins_recover_installed_state_failed", {
            key: args.key,
            pluginId: id,
            operation: operation.action,
            error: String(recoverError),
          });
        }
      }
      throw errorToThrow;
    } finally {
      setBusy(id, false);
      if (operation.clearProgressAfterDone !== false) scheduleProgressClear(id);
    }
  }

  return {
    createProgressHandler,
    setFailedProgress,
    runBusyPluginOperation,
  };
}
