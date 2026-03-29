/**
 * @fileoverview usePluginTaskRunner.ts
 * @description plugins｜页面辅助：统一“fire-and-forget”插件操作任务提交。
 */

import type { PluginLifecycleCommandOutcome } from "@/features/plugins/api-types";

/**
 * 触发插件操作任务，并吞掉仍可能由底层 bug 抛出的异常，避免未处理 Promise 告警。
 *
 * 说明：
 * - 正常业务失败应通过 `PluginLifecycleCommandOutcome` 返回，而不是抛错；
 * - 失败进度与错误展示仍由 install store 的状态承载。
 *
 * @param task - 插件操作 Promise。
 */
export function runPluginTask(task: Promise<PluginLifecycleCommandOutcome>): void {
  void task.catch(() => {
    // 错误由 pluginInstallStore 的 progress/failed 状态承载。
  });
}
