/**
 * @fileoverview chat｜presentation composable：插件中心导航编排。
 * @description 统一插件中心入口跳转与安装提示跳转逻辑。
 */

import type { ComputedRef, Ref } from "vue";
import type { Router } from "vue-router";

type RefLike<T> = Ref<T> | ComputedRef<T>;

/**
 * 主页面插件相关导航行为。
 */
export function usePluginNavigation(router: Router, missingRequiredCount: RefLike<number>) {
  function goPlugins(): void {
    void router.push({
      path: "/plugins",
      query: missingRequiredCount.value > 0 ? { filter: "required" } : {},
    });
  }

  function handleInstallHint(pluginId: string | undefined): void {
    if (!pluginId) {
      void router.push("/plugins");
      return;
    }
    void router.push({ path: "/plugins", query: { focus_plugin_id: pluginId } });
  }

  return {
    goPlugins,
    handleInstallHint,
  };
}

