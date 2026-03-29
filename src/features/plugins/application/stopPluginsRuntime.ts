/**
 * @fileoverview plugins runtime shutdown
 * @description
 * 统一停止 plugins feature 的运行时子系统，供根 capability 的 lease release 使用。
 */

import { stopPluginsFeatureRuntime } from "./runtimeLifecycle";

/**
 * 停止 plugins feature 运行时（best-effort）。
 */
export async function stopPluginsRuntime(): Promise<void> {
  await stopPluginsFeatureRuntime();
}
