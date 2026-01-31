/**
 * @fileoverview router.ts 文件职责说明。
 */
import { createRouter, createWebHistory } from "vue-router";
import LoginPage from "../features/auth/presentation/pages/LoginPage.vue";

/**
 * Exported constant.
 * @constant
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: LoginPage },
    { path: "/chat", component: () => import("../features/chat/presentation/pages/MainPage.vue") },
    { path: "/settings", component: () => import("../features/settings/presentation/pages/SettingPage.vue") },
    { path: "/required-setup", component: () => import("../features/auth/presentation/pages/RequiredSetupPage.vue") },
    { path: "/plugins", component: () => import("../features/plugins/presentation/pages/PluginCenterPage.vue") },
    {
      path: "/plugins/detail/:pluginId",
      component: () => import("../features/plugins/presentation/pages/PluginDetailPage.vue"),
      props: true,
    },
    {
      path: "/user_info",
      name: "UserInfoPage",
      component: () => import("../features/user/presentation/pages/UserInfoPage.vue"),
    },
    { path: "/channel-info", component: () => import("../features/channels/presentation/pages/ChannelInfoPage.vue") },
    { path: "/user-info-popover", component: () => import("../features/user/presentation/pages/UserPopoverPage.vue") },
    { path: "/channel-info-popover", component: () => import("../features/channels/presentation/pages/ChannelPopoverPage.vue") },
  ],
});
