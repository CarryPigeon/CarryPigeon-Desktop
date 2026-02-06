/**
 * @fileoverview Patchbay 生命周期编排（挂载/卸载）。
 * @description chat｜模块：usePatchbayLifecycle。
 * 将 MainPage 中与“首屏初始化 + 全局监听器注册/清理”相关的逻辑集中在一起，减少页面文件体积，
 * 并统一生命周期副作用的入口，避免未来拆组件时遗漏清理。
 */

import { onBeforeUnmount, onMounted, type ComputedRef, type Ref } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";

/**
 * Patchbay 生命周期编排参数。
 */
export type PatchbayLifecycleArgs = {
  /**
   * 当前路由（用于读取 query 并清理 welcome 参数）。
   */
  route: RouteLocationNormalizedLoaded;
  /**
   * 路由实例（用于修改 query 或跳转）。
   */
  router: Router;
  /**
   * 顶部闪现提示（UI 层）。
   */
  flashMessage: Ref<string>;
  /**
   * 当前 server socket（已 trim）。
   */
  socket: ComputedRef<string>;
  /**
   * 将插件 host bridge 注入到 domain registry（避免循环依赖）。
   */
  attachPluginHostBridge: () => void;
  /**
   * 连接 server（通常为 `connectWithRetry`）。
   */
  connect: (socket: string) => Promise<void>;
  /**
   * 刷新与 server 绑定的 store（server-info/catalog/domain-catalog/installed）。
   */
  refreshStores: () => Promise<void>;
  /**
   * 当插件相关 store 刷新完成后的收尾动作（例如 recheckRequired）。
   */
  afterPluginStoresReady: () => void;
  /**
   * 确保插件运行时已加载（用于消息渲染/编辑器插件能力）。
   */
  ensurePluginRuntime: () => Promise<void>;
  /**
   * 确保聊天模块已准备就绪（频道/消息/成员）。
   */
  ensureChatReady: () => void | Promise<void>;
  /**
   * 消息面板容器 ref（用于首次滚动到底部）。
   */
  signalPaneRef: Ref<HTMLElement | null>;
  /**
   * 尝试上报当前阅读状态（best-effort）。
   */
  maybeReportReadState: () => void;
  /**
   * 全局按键处理（Patchbay 窗口级别）。
   */
  onKeydown: (e: KeyboardEvent) => void;
  /**
   * 窗口 focus 事件处理（用于刷新/上报等）。
   */
  onWindowFocus: () => void;
  /**
   * document visibilitychange 事件处理（用于刷新/上报等）。
   */
  onVisibilityChange: () => void;
  /**
   * 卸载时的额外清理（例如移除 host bridge）。
   */
  dispose?: () => void;
};

/**
 * 注册 Patchbay 的挂载/卸载编排。
 *
 * @param args - PatchbayLifecycleArgs
 * @returns 无返回值。
 */
export function usePatchbayLifecycle(args: PatchbayLifecycleArgs): void {
  const {
    route,
    router,
    flashMessage,
    socket,
    attachPluginHostBridge,
    connect,
    refreshStores,
    afterPluginStoresReady,
    ensurePluginRuntime,
    ensureChatReady,
    signalPaneRef,
    maybeReportReadState,
    onKeydown,
    onWindowFocus,
    onVisibilityChange,
    dispose,
  } = args;

  onMounted(() => {
    if (String(route.query.welcome ?? "") === "new") {
      flashMessage.value = "Account created. Welcome.";
      void router.replace({ query: {} });
      window.setTimeout(() => {
        flashMessage.value = "";
      }, 2400);
    }

    attachPluginHostBridge();
    void connect(socket.value)
      .then(refreshStores)
      .then(afterPluginStoresReady)
      .then(ensurePluginRuntime);
    void ensureChatReady();

    window.setTimeout(() => {
      const el = signalPaneRef.value;
      if (el) el.scrollTop = el.scrollHeight;
      maybeReportReadState();
    }, 0);

    window.addEventListener("keydown", onKeydown);
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("focus", onWindowFocus);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    dispose?.();
  });
}
