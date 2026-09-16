/**
 * @fileoverview 插件全局 UI 挂载能力工厂。
 * @description plugins｜runtime：把宿主提供的 chat UI 桥封装为插件可用的 overlay / 工具栏入口。
 */

import type { Component } from "vue";
import type { PluginChatContext, PluginOverlayMountHandle } from "@/features/plugins/domain/types/pluginRuntimeTypes";
import type { PluginScope } from "./pluginScope";

/**
 * 宿主提供的 chat UI 桥（Task 4 实现 mountOverlay / registerToolbarAction）。
 * 插件运行时只通过该桥挂载全局 UI，不直接接触宿主组件树。
 */
export type PluginUiBridge = {
  mountOverlay(component: Component, opts?: { zIndex?: number; props?: Record<string, unknown> }): PluginOverlayMountHandle;
  registerToolbarAction(action: {
    id: string;
    label: string;
    icon?: Component;
    order?: number;
    onClick: (ctx: PluginChatContext) => void;
  }): () => void;
};

/**
 * 判断插件 scope 是否已销毁（已销毁时输出英文告警，含 pluginId）。
 * 供 UI 挂载能力做 dispose 后的 no-op 防御。
 */
function warnIfScopeDisposed(scope: PluginScope | undefined, pluginId: string): boolean {
  if (scope?.disposed) {
    console.warn(
      `[plugin-ui-api] plugin "${pluginId}" scope is disposed; ui api is a no-op`,
    );
    return true;
  }
  return false;
}

/**
 * 把 `PluginUiBridge` 封装为插件 host API 所需的 `{ mountOverlay, registerToolbarAction }`。
 *
 * 说明：
 * - 传入 `scope` 时，`mountOverlay` / `registerToolbarAction` 的清理动作会
 *   同时注册到 `scope.onDispose`（返回值保留，双重保险）；
 * - scope 已销毁后调用变为 no-op 并告警（不改变既有权限门控语义）。
 *
 * @param ui 宿主 chat UI 桥实例。
 * @param scope 可选的插件作用域（销毁时自动清理挂载资源）。
 * @param pluginId 插件标识（用于 dispose 防御告警定位）。
 */
export function createPluginUiApi(ui: PluginUiBridge, scope?: PluginScope, pluginId: string = "unknown") {
  return {
    mountOverlay: (component: Component, opts?: { zIndex?: number }) => {
      // scope 已销毁：挂载 no-op，返回无害句柄保持签名兼容
      if (warnIfScopeDisposed(scope, pluginId)) {
        return { unmount: () => {}, instance: null } satisfies PluginOverlayMountHandle;
      }
      const handle = ui.mountOverlay(component, opts);
      if (scope) {
        // 双重保险：scope dispose 时自动卸载浮层
        const revoke = scope.onDispose(() => handle.unmount());
        const originalUnmount = handle.unmount;
        handle.unmount = () => {
          revoke();
          originalUnmount();
        };
      }
      return handle;
    },
    registerToolbarAction: (action: Parameters<PluginUiBridge["registerToolbarAction"]>[0]) => {
      // scope 已销毁：注册 no-op
      if (warnIfScopeDisposed(scope, pluginId)) {
        return () => {};
      }
      const cancel = ui.registerToolbarAction(action);
      if (scope) {
        // 双重保险：scope dispose 时自动反注册工具栏入口
        const revoke = scope.onDispose(cancel);
        return () => {
          revoke();
          cancel();
        };
      }
      return cancel;
    },
  };
}
