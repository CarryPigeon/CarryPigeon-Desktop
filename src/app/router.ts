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
import { LoginPage, RequiredSetupPage, UserInfoPage, UserPopoverPage } from "@/features/account/routes";
import {
  ChannelBansPage,
  ChannelInfoPage,
  ChannelInfoPopoverView,
  ChannelMembersPage,
  ChatMainPage,
  JoinApplicationsPage,
} from "@/features/chat/routes";
import { DomainCatalogPage, PluginCenterPage, PluginDetailPage } from "@/features/plugins/routes";
import { ServerManagerPage } from "@/features/server-connection/routes";
import { SettingsPage } from "@/features/settings/routes";

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
    { path: "/chat", component: ChatMainPage },
    { path: "/settings", component: SettingsPage },
    { path: "/servers", component: ServerManagerPage },
    { path: "/required-setup", component: RequiredSetupPage },
    { path: "/plugins", component: PluginCenterPage },
    { path: "/domains", component: DomainCatalogPage },
    {
      path: "/plugins/detail/:pluginId",
      component: PluginDetailPage,
      props: true,
    },
    {
      path: "/user_info",
      name: "UserInfoPage",
      component: UserInfoPage,
    },
    { path: "/channel-info", component: ChannelInfoPage },
    { path: "/user-info-popover", component: UserPopoverPage },
    { path: "/channel-info-popover", component: ChannelInfoPopoverView },
    // 频道管理相关路由
    { path: "/channel-members", component: ChannelMembersPage },
    { path: "/channel-applications", component: JoinApplicationsPage },
    { path: "/channel-bans", component: ChannelBansPage },
  ],
});
