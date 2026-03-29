/**
 * @fileoverview subWindowRouting.ts
 * @description 应用启动编排：子窗口路由分发。
 */

import type { Router } from "vue-router";

/**
 * 提取各类 profile 相关子窗口共享的 query 字段。
 */
function buildCommonProfileQuery(searchParams: URLSearchParams): Record<string, string> {
  return {
    avatar: searchParams.get("avatar") ?? "",
    name: searchParams.get("name") ?? "",
    bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
  };
}

function replaceSubWindowRoute(
  router: Router,
  path: string,
  query: Record<string, string>,
): boolean {
  void router.replace({ path, query });
  return true;
}

/**
 * 当当前 WebView 以“辅助窗口”启动时，将其路由到对应页面。
 *
 * @param router - 应用路由实例。
 * @param searchParams - 当前 location 的 URLSearchParams。
 * @returns 当该实例应被视作子窗口时返回 `true`。
 */
export function routeIfSubWindow(router: Router, searchParams: URLSearchParams): boolean {
  const windowType = searchParams.get("window");
  if (!windowType) return false;
  const commonProfileQuery = buildCommonProfileQuery(searchParams);

  switch (windowType) {
    case "user-info-popover":
      return replaceSubWindowRoute(router, "/user-info-popover", {
        ...commonProfileQuery,
        email: searchParams.get("email") ?? "",
      });
    case "channel-info-popover":
      return replaceSubWindowRoute(router, "/channel-info-popover", commonProfileQuery);
    case "channel-info":
      return replaceSubWindowRoute(router, "/channel-info", {
        ...commonProfileQuery,
        owner: searchParams.get("owner") ?? "",
      });
    case "user-profile":
      return replaceSubWindowRoute(router, "/user_info", {
        ...commonProfileQuery,
        uid: searchParams.get("uid") ?? "",
        email: searchParams.get("email") ?? "",
        sex: searchParams.get("sex") ?? "",
        birthday: searchParams.get("birthday") ?? "",
        avatar_id: searchParams.get("avatar_id") ?? "",
        editable: searchParams.get("editable") ?? "",
      });
    default:
      // 未知 window 类型应回落为主窗口流程，避免误判为子窗口导致 bootstrap 缺失。
      return false;
  }
}
