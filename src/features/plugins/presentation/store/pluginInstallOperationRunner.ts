/**
 * @fileoverview pluginInstallOperationRunner.ts
 * @description plugins｜展示层编排：按 policy 执行插件安装态操作。
 */

import type { PluginProgress } from "@/features/plugins/domain/types/pluginTypes";
import type { PluginInstallActionsDeps } from "./pluginInstallActionTypes";
import type { PluginInstallOperation } from "./pluginInstallOperations";
import { getPluginInstallOperationPolicy } from "./pluginInstallOperationPolicy";

type RunPluginInstallOperationArgs = {
  pluginId: string;
  operation: PluginInstallOperation;
  task: (onProgress: (progress: PluginProgress) => void) => Promise<void>;
};

type PluginInstallOperationRunner = {
  run(args: RunPluginInstallOperationArgs): Promise<void>;
};

/**
 * 创建带 policy 的插件安装操作执行器。
 */
export function createPluginInstallOperationRunner(
  deps: PluginInstallActionsDeps,
): PluginInstallOperationRunner {
  async function run(args: RunPluginInstallOperationArgs): Promise<void> {
    const pluginId = String(args.pluginId ?? "").trim();
    if (!pluginId) return;

    const policy = getPluginInstallOperationPolicy(args.operation);
    const onProgress = deps.createProgressHandler(pluginId);

    await deps.runBusyPluginOperation({
      pluginId,
      action: args.operation,
      initialProgress: policy.createInitialProgress(pluginId),
      recoverInstalledOnError: policy.recoverInstalledOnError,
      clearProgressAfterDone: policy.clearProgressAfterDone,
      onError: (error: unknown): void => {
        deps.logger.error(`Action: ${policy.failureAction}`, {
          key: deps.key,
          pluginId,
          operation: args.operation,
          error: String(error),
          concurrency: policy.concurrency,
        });
        deps.setFailedProgress(pluginId, error);
      },
      task: () => args.task(onProgress),
    });
  }

  return { run };
}
