/**
 * @fileoverview pluginInstallOperationPolicy.ts
 * @description plugins｜展示层编排：插件安装态操作 policy。
 *
 * 说明：
 * - 明确每种操作的并发语义、起始进度与失败日志 action；
 * - 将“busy-gate / recover / progress”规则从具体动作函数中抽离。
 */

import type { PluginProgress } from "@/features/plugins/domain/types/pluginTypes";
import { PLUGIN_INSTALL_OPERATION, type PluginInstallOperation } from "./pluginInstallOperations";

export type PluginInstallOperationPolicy = {
  concurrency: "busy-gate";
  recoverInstalledOnError: boolean;
  clearProgressAfterDone: boolean;
  createInitialProgress(pluginId: string): PluginProgress;
};

const OPERATION_POLICY_BY_TYPE: Record<PluginInstallOperation, Omit<PluginInstallOperationPolicy, "createInitialProgress"> & {
  progress: Omit<PluginProgress, "pluginId">;
}> = {
  [PLUGIN_INSTALL_OPERATION.install]: {
    concurrency: "busy-gate",
    recoverInstalledOnError: true,
    clearProgressAfterDone: true,
    progress: { stage: "confirm", percent: 0, message: "Starting…" },
  },
  [PLUGIN_INSTALL_OPERATION.update]: {
    concurrency: "busy-gate",
    recoverInstalledOnError: true,
    clearProgressAfterDone: true,
    progress: { stage: "checking_updates", percent: 10, message: "Checking updates…" },
  },
  [PLUGIN_INSTALL_OPERATION.switchVersion]: {
    concurrency: "busy-gate",
    recoverInstalledOnError: true,
    clearProgressAfterDone: true,
    progress: { stage: "switching", percent: 22, message: "Switching version…" },
  },
  [PLUGIN_INSTALL_OPERATION.rollback]: {
    concurrency: "busy-gate",
    recoverInstalledOnError: true,
    clearProgressAfterDone: true,
    progress: { stage: "rolling_back", percent: 18, message: "Rolling back…" },
  },
  [PLUGIN_INSTALL_OPERATION.enable]: {
    concurrency: "busy-gate",
    recoverInstalledOnError: true,
    clearProgressAfterDone: true,
    progress: { stage: "enabling", percent: 18, message: "Enabling…" },
  },
  [PLUGIN_INSTALL_OPERATION.disable]: {
    concurrency: "busy-gate",
    recoverInstalledOnError: true,
    clearProgressAfterDone: true,
    progress: { stage: "confirm", percent: 18, message: "Disabling…" },
  },
  [PLUGIN_INSTALL_OPERATION.uninstall]: {
    concurrency: "busy-gate",
    recoverInstalledOnError: true,
    clearProgressAfterDone: true,
    progress: { stage: "confirm", percent: 22, message: "Uninstalling…" },
  },
};

/**
 * 读取某个插件安装操作的标准 policy。
 */
export function getPluginInstallOperationPolicy(
  operation: PluginInstallOperation,
): PluginInstallOperationPolicy {
  const policy = OPERATION_POLICY_BY_TYPE[operation];
  return {
    concurrency: policy.concurrency,
    recoverInstalledOnError: policy.recoverInstalledOnError,
    clearProgressAfterDone: policy.clearProgressAfterDone,
    createInitialProgress(pluginId: string): PluginProgress {
      return {
        pluginId,
        stage: policy.progress.stage,
        percent: policy.progress.percent,
        message: policy.progress.message,
      };
    },
  };
}
