/**
 * @fileoverview plugins 运行时能力服务：ui。
 * @description
 * 把宿主 chat UI 桥封装为插件可用的 overlay / 工具栏注册能力。
 * 注册产生的资源通过 `ctx.effect` 绑定到插件 fiber，fiber 销毁时自动释放。
 */

import type { Context } from "@cordisjs/core";
import type { Component } from "vue";
import type {
  PluginChatContext,
  PluginOverlayMountHandle,
} from "@/features/plugins/domain/types/pluginRuntimeTypes";
import { isGuardDisposed, type RuntimeGuard } from "../guard";
import type { PluginUiService } from "../types";

/** 宿主提供的 chat UI 桥（由 chat feature 实现）。 */
export type PluginUiBridge = {
  mountOverlay(
    component: Component,
    opts?: { zIndex?: number; props?: Record<string, unknown> },
  ): PluginOverlayMountHandle;
  registerToolbarAction(action: {
    id: string;
    label: string;
    icon?: Component;
    order?: number;
    onClick: (ctx: PluginChatContext) => void;
  }): () => void;
};

/**
 * 创建 UI 能力服务。
 *
 * @param ui 宿主 chat UI 桥。
 * @param pluginCtx 插件 fiber 上下文（用于绑定自动清理）。
 * @param pluginId 插件标识（日志定位）。
 * @param guard 运行时守卫。
 */
export function createUiService(
  ui: PluginUiBridge,
  pluginCtx: Context,
  pluginId: string,
  guard: RuntimeGuard,
): PluginUiService {
  return {
    mountOverlay(component: Component, opts?: { zIndex?: number; props?: Record<string, unknown> }) {
      if (isGuardDisposed(guard, "ui.mountOverlay", pluginId)) {
        return { unmount: () => {}, instance: null };
      }
      const handle = ui.mountOverlay(component, opts);
      // 绑定到插件 fiber：fiber 销毁时自动卸载浮层（effect 返回值即清理函数）。
      pluginCtx.effect(() => () => handle.unmount());
      return handle;
    },
    registerToolbarAction(action: Parameters<PluginUiBridge["registerToolbarAction"]>[0]) {
      if (isGuardDisposed(guard, "ui.registerToolbarAction", pluginId)) {
        return () => {};
      }
      const cancel = ui.registerToolbarAction(action);
      pluginCtx.effect(() => cancel);
      return cancel;
    },
  };
}
