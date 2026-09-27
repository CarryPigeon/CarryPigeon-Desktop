import { markRaw, reactive } from "vue";
import type { Component } from "vue";
import type { PluginOverlayMountHandle } from "@/features/plugins/api-types";
import type { PluginUiBridge, ToolbarAction } from "@/features/plugins/api-types";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("chatPluginUiBridge");

// 工具栏动作响应式列表：PluginToolbarSlot 渲染它。
export const toolbarActions = reactive<ToolbarAction[]>([]);

/** 浮层宿主提供的挂载函数（`PluginOverlayHost` 的 expose.mount）。 */
type OverlayMountFn = (c: Component, opts?: { zIndex?: number; props?: Record<string, unknown> }) => PluginOverlayMountHandle;

/**
 * 浮层注册请求：插件只注册一次，宿主页面可能反复挂载/卸载。
 *
 * 说明：`handle` 指向“当前宿主实例”的挂载句柄；宿主卸载时置空，
 * 重新挂载时（`bindOverlayMount`）按注册顺序重放到新宿主。
 */
type OverlayRegistration = {
  id: number;
  component: Component;
  opts?: { zIndex?: number; props?: Record<string, unknown> };
  handle: PluginOverlayMountHandle | null;
};

/** 浮层注册表（模块级）：插件作用域在插件激活时注册，与宿主页面生命周期解耦。 */
const overlayRegistrations = new Map<number, OverlayRegistration>();
let overlaySeq = 0;

// 当前已挂载的浮层宿主（未挂载时为 null）。
let overlayMount: OverlayMountFn | null = null;

/**
 * 绑定/解绑浮层宿主，并把既有插件浮层注册重放到新宿主。
 *
 * 背景：插件只在 activate 时调用一次 `host.mountOverlay`，而承载浮层的页面
 * （ChatCenter）会随「聊天 / 插件中心 / 设置」切换反复挂载与卸载。
 * 若把注册结果只留在组件实例里，离开页面即丢失，插件持有的句柄指向已销毁的列表，
 * 返回聊天后工具栏入口静默失效（现象：访问一次插件中心，「AI 总结」「群通知」按钮点不动）。
 * 因此注册表放在模块级，宿主挂载时重放、卸载时置空（句柄的 `instance` getter 实时读取）。
 *
 * @param fn - 浮层挂载函数；传 `null` 表示宿主已卸载。
 * @returns 无返回值。
 */
export function bindOverlayMount(fn: OverlayMountFn | null): void {
  overlayMount = fn;
  if (!fn) {
    for (const registration of overlayRegistrations.values()) registration.handle = null;
    return;
  }
  for (const registration of overlayRegistrations.values()) {
    registration.handle = fn(registration.component, registration.opts);
  }
}

export const chatPluginUiBridge: PluginUiBridge = {
  mountOverlay(component, opts) {
    const id = ++overlaySeq;
    // 宿主页面尚未挂载（例如插件在插件中心启用）：先登记注册，宿主挂载时重放，注册不丢失。
    if (!overlayMount) {
      logger.info("Action: chat_plugin_ui_overlay_deferred_until_host_ready", { pending: overlayRegistrations.size + 1 });
    }
    const registration: OverlayRegistration = {
      id,
      component: markRaw(component),
      opts,
      handle: overlayMount ? overlayMount(component, opts) : null,
    };
    overlayRegistrations.set(id, registration);
    return {
      // 句柄不直接暴露宿主实例：instance 经注册表实时读取，宿主重挂载后自动指向新实例。
      get instance() {
        return registration.handle?.instance ?? null;
      },
      unmount: () => {
        registration.handle?.unmount();
        registration.handle = null;
        overlayRegistrations.delete(id);
      },
    };
  },
  registerToolbarAction(action) {
    // markRaw：icon 是插件传入的组件定义，push 进 reactive 数组会被深度代理，
    // 渲染 <component :is="a.icon"> 时触发「Component made reactive」告警。
    // 在注册边界统一标记为不可代理，PluginToolbarSlot 无需感知。
    toolbarActions.push(action.icon ? { ...action, icon: markRaw(action.icon) } : action);
    const id = action.id;
    return () => {
      const i = toolbarActions.findIndex((a) => a.id === id);
      if (i >= 0) toolbarActions.splice(i, 1);
    };
  },
};

/**
 * 清空浮层注册表（仅供测试重置模块级单例）。
 *
 * @returns 无返回值。
 */
export function resetOverlayRegistrations(): void {
  for (const registration of overlayRegistrations.values()) registration.handle?.unmount();
  overlayRegistrations.clear();
  overlayMount = null;
  overlaySeq = 0;
}
