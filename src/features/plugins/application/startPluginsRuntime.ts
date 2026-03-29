/**
 * @fileoverview plugins runtime bootstrap
 * @description
 * 统一启动 plugins feature 的运行时子系统，作为 feature 级 composition root 启动入口。
 */

import { startPluginsFeatureRuntime } from "./runtimeLifecycle";

/**
 * 启动 plugins feature 运行时（幂等）。
 */
export function startPluginsRuntime(): void {
  startPluginsFeatureRuntime();
}
