/**
 * @fileoverview useLoginHotkeys.ts
 * @description account/auth-flow｜页面编排：登录页全局快捷键。
 */

import { onBeforeUnmount, onMounted } from "vue";
import type { Router } from "vue-router";

/**
 * 注册登录页快捷键。
 *
 * - Ctrl/Cmd+P：打开插件中心
 * - Ctrl/Cmd+,：打开设置页
 *
 * @param router - 路由实例。
 */
export function useLoginHotkeys(router: Router): void {
  function onGlobalKeydown(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    const meta = e.metaKey || e.ctrlKey;
    if (!meta) return;

    if (k === "p") {
      e.preventDefault();
      void router.push("/plugins");
      return;
    }

    if (k === ",") {
      e.preventDefault();
      void router.push("/settings");
    }
  }

  onMounted(() => {
    window.addEventListener("keydown", onGlobalKeydown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", onGlobalKeydown);
  });
}
