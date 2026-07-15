/**
 * @fileoverview 插件全局 UI 挂载能力工厂。
 * @description plugins｜runtime：把宿主提供的 chat UI 桥封装为插件可用的 overlay / 工具栏入口。
 */

import type { Component } from "vue";

/**
 * 宿主提供的 chat UI 桥（Task 4 实现 mountOverlay / registerToolbarAction）。
 * 插件运行时只通过该桥挂载全局 UI，不直接接触宿主组件树。
 */
export type PluginUiBridge = {
  mountOverlay(component: Component, opts?: { zIndex?: number }): () => void;
  registerToolbarAction(action: {
    id: string;
    label: string;
    icon?: Component;
    order?: number;
    onClick: () => void;
  }): () => void;
};

/**
 * 把 `PluginUiBridge` 封装为插件 host API 所需的 `{ mountOverlay, registerToolbarAction }`。
 *
 * @param ui 宿主 chat UI 桥实例。
 */
export function createPluginUiApi(ui: PluginUiBridge) {
  return {
    mountOverlay: (component: Component, opts?: { zIndex?: number }) =>
      ui.mountOverlay(component, opts),
    registerToolbarAction: (action: Parameters<PluginUiBridge["registerToolbarAction"]>[0]) =>
      ui.registerToolbarAction(action),
  };
}
