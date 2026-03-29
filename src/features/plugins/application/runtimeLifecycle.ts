/**
 * @fileoverview plugins runtime lifecycle application facade。
 * @description
 * 收敛 plugins feature 各运行时子系统的启动与停止，避免入口文件直接依赖展示层 store。
 */

import { getPluginsRuntimeLifecycleAccess } from "../di/plugins.di";

export function startPluginsFeatureRuntime(): void {
  getPluginsRuntimeLifecycleAccess().start();
}

export async function stopPluginsFeatureRuntime(): Promise<void> {
  await getPluginsRuntimeLifecycleAccess().stop();
}
