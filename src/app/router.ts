/**
 * @fileoverview 应用路由表（Web/Tauri 预览构建）。
 *
 * 该文件定义 SPA 路由（Tauri/Vite WebView 预览构建使用）。
 * 按 Clean Architecture 的边界约束：router 仅依赖展示层页面（UI layer），不依赖 domain/data 层细节。
 *
 * 备注：
 * - 主流程：登录（`/`）、聊天主窗口（`/chat`）、插件（`/plugins`）、required gate（`/required-setup`）、设置（`/settings`）。
 * - popover/aux 路由用于多窗口启动（见 `src/main.ts`）。
 */
import { createRouter, createWebHistory } from "vue-router";
import LoginPage from "../features/auth/presentation/pages/LoginPage.vue";

/**
 * 应用全局 Vue Router 实例。
 *
 * - Web 预览构建使用 HTML5 history。
 * - 在合适位置使用懒加载，以减少首屏加载体积。
 *
 * @constant
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: LoginPage },
    { path: "/chat", component: () => import("../features/chat/presentation/pages/MainPage.vue") },
    { path: "/settings", component: () => import("../features/settings/presentation/pages/SettingPage.vue") },
    { path: "/servers", component: () => import("../features/servers/presentation/pages/ServerManagerPage.vue") },
    { path: "/required-setup", component: () => import("../features/auth/presentation/pages/RequiredSetupPage.vue") },
    { path: "/plugins", component: () => import("../features/plugins/presentation/pages/PluginCenterPage.vue") },
    { path: "/domains", component: () => import("../features/plugins/presentation/pages/DomainCatalogPage.vue") },
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
    { path: "/channel-info", component: () => import("../features/chat/presentation/pages/ChannelInfoPage.vue") },
    { path: "/user-info-popover", component: () => import("../features/user/presentation/pages/UserPopoverPage.vue") },
    { path: "/channel-info-popover", component: () => import("../features/chat/presentation/pages/ChannelPopoverPage.vue") },
    // 频道管理相关路由
    { path: "/channel-members", component: () => import("../features/chat/presentation/pages/ChannelMembersPage.vue") },
    { path: "/channel-applications", component: () => import("../features/chat/presentation/pages/JoinApplicationsPage.vue") },
    { path: "/channel-bans", component: () => import("../features/chat/presentation/pages/ChannelBansPage.vue") },
  ],
});
