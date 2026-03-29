/**
 * @fileoverview Patchbay 生命周期编排（挂载/卸载）。
 * @description chat｜presentation composable：收敛主页面启动链路与全局监听器生命周期。
 * 将 MainPage 中与“首屏初始化 + 全局监听器注册/清理”相关的逻辑集中在一起，减少页面文件体积，
 * 并统一生命周期副作用的入口，避免未来拆组件时遗漏清理。
 */

import { onBeforeUnmount, onMounted, type Ref } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";

/**
 * Patchbay 生命周期编排参数。
 */
export type PatchbayLifecycleArgs = {
  // 路由上下文（welcome query 读取与清理）。
  route: RouteLocationNormalizedLoaded;
  router: Router;

  // 页面 UI 状态。
  flashMessage: Ref<string>;
  bootstrap(): Promise<void>;

  // 视口同步。
  signalPaneRef: Ref<HTMLElement | null>;
  maybeReportReadState: () => void;

  // 全局监听器处理器。
  onKeydown: (e: KeyboardEvent) => void;
  onWindowFocus: () => void;
  onVisibilityChange: () => void;

  // 卸载清理与错误上报。
  dispose?: () => void;
  onBootstrapError?: (error: unknown) => void;
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
    bootstrap,
    signalPaneRef,
    maybeReportReadState,
    onKeydown,
    onWindowFocus,
    onVisibilityChange,
    dispose,
    onBootstrapError,
  } = args;

  function showWelcomeIfNeeded(): void {
    if (String(route.query.welcome ?? "") !== "new") return;
    flashMessage.value = "Account created. Welcome.";
    void router.replace({ query: {} });
    window.setTimeout(() => {
      flashMessage.value = "";
    }, 2400);
  }

  function scheduleInitialViewportSync(): void {
    window.setTimeout(() => {
      const el = signalPaneRef.value;
      if (el) el.scrollTop = el.scrollHeight;
      maybeReportReadState();
    }, 0);
  }

  onMounted(() => {
    showWelcomeIfNeeded();

    void bootstrap().catch((error) => {
      onBootstrapError?.(error);
    });

    scheduleInitialViewportSync();

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
