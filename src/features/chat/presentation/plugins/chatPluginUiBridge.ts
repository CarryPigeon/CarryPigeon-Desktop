import { reactive } from "vue";
import type { Component } from "vue";
import type { PluginOverlayMountHandle } from "@/features/plugins/api-types";
import type { PluginUiBridge, ToolbarAction } from "@/features/plugins/api-types";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("chatPluginUiBridge");

// 工具栏动作响应式列表：PluginToolbarSlot 渲染它。
export const toolbarActions = reactive<ToolbarAction[]>([]);

// 浮层挂载函数由 PluginOverlayHost 的 expose.mount 在运行时注入。
let overlayMount: ((c: Component, opts?: { zIndex?: number; props?: Record<string, unknown> }) => PluginOverlayMountHandle) | null = null;
export function bindOverlayMount(fn: (c: Component, opts?: { zIndex?: number; props?: Record<string, unknown> }) => PluginOverlayMountHandle): void {
  overlayMount = fn;
}

export const chatPluginUiBridge: PluginUiBridge = {
  mountOverlay(component, opts) {
    if (!overlayMount) {
      logger.warn("Action: chat_plugin_ui_overlay_host_not_ready");
      return { unmount: () => {}, instance: null };
    }
    return overlayMount(component, opts);
  },
  registerToolbarAction(action) {
    toolbarActions.push(action);
    const id = action.id;
    return () => {
      const i = toolbarActions.findIndex((a) => a.id === id);
      if (i >= 0) toolbarActions.splice(i, 1);
    };
  },
};
