/**
 * @fileoverview subWindowRouting.ts
 * @description 应用启动编排：子窗口路由分发。
 */

import type { Router } from "vue-router";

/**
 * 当当前 WebView 以“辅助窗口”启动时，将其路由到对应页面。
 *
 * @param router - 应用路由实例。
 * @param searchParams - 当前 location 的 URLSearchParams。
 * @returns 当该实例应被视作子窗口时返回 `true`。
 */
export function routeIfSubWindow(router: Router, searchParams: URLSearchParams): boolean {
  const windowType = searchParams.get("window");
  const isSubWindow = Boolean(windowType);
  if (!windowType) return false;

  if (windowType === "user-info-popover") {
    void router.replace({
      path: "/user-info-popover",
      query: {
        avatar: searchParams.get("avatar") ?? "",
        name: searchParams.get("name") ?? "",
        email: searchParams.get("email") ?? "",
        bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
      },
    });
    return true;
  }

  if (windowType === "channel-info-popover") {
    void router.replace({
      path: "/channel-info-popover",
      query: {
        avatar: searchParams.get("avatar") ?? "",
        name: searchParams.get("name") ?? "",
        bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
      },
    });
    return true;
  }

  if (windowType === "channel-info") {
    void router.replace({
      path: "/channel-info",
      query: {
        avatar: searchParams.get("avatar") ?? "",
        name: searchParams.get("name") ?? "",
        bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
        owner: searchParams.get("owner") ?? "",
      },
    });
    return true;
  }

  if (windowType === "user-profile") {
    void router.replace({
      path: "/user_info",
      query: {
        uid: searchParams.get("uid") ?? "",
        avatar: searchParams.get("avatar") ?? "",
        name: searchParams.get("name") ?? "",
        email: searchParams.get("email") ?? "",
        bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
        sex: searchParams.get("sex") ?? "",
        birthday: searchParams.get("birthday") ?? "",
        avatar_id: searchParams.get("avatar_id") ?? "",
        editable: searchParams.get("editable") ?? "",
      },
    });
    return true;
  }

  return isSubWindow;
}

