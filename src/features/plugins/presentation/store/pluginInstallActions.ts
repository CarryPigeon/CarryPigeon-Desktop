/**
 * @fileoverview pluginInstallActions.ts
 * @description plugins｜展示层编排：插件安装态动作集合。
 */

import { createPluginInstallInstallUpdateActions } from "./pluginInstallInstallUpdateActions";
import { createPluginInstallLifecycleActions } from "./pluginInstallLifecycleActions";
import type {
  PluginInstallActions,
  PluginInstallActionsDeps,
} from "./pluginInstallActionTypes";

/**
 * 创建插件安装态动作集合（保持 store 对外 API 不变）。
 *
 * 分层：
 * - install/update：catalog 相关动作；
 * - switch/rollback/enable/disable/uninstall：生命周期动作。
 */
export function createPluginInstallActions(
  deps: PluginInstallActionsDeps,
): PluginInstallActions {
  const installUpdateActions = createPluginInstallInstallUpdateActions(deps);
  const lifecycleActions = createPluginInstallLifecycleActions(deps);
  return {
    install: installUpdateActions.install,
    updateToLatest: installUpdateActions.updateToLatest,
    switchVersion: lifecycleActions.switchVersion,
    rollback: lifecycleActions.rollback,
    enable: lifecycleActions.enable,
    disable: lifecycleActions.disable,
    uninstall: lifecycleActions.uninstall,
  };
}
