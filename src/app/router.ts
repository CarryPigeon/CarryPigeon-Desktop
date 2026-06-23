import { createRouter, createWebHistory } from 'vue-router';
import { LoginPage, RequiredSetupPage, UserInfoPage } from '@/features/account/routes';
import { ChatMainPage, ChannelInfoPage, ChannelMembersPage, JoinApplicationsPage, ChannelBansPage } from '@/features/chat/public/routes';
import { PluginCenterPage, DomainCatalogPage, PluginDetailPage } from '@/features/plugins/routes';
import { SettingsPage, EmojiManagePage } from '@/features/settings/routes';
import { ServerManagerPage } from '@/features/server-connection/routes';
import { FileManagerPage } from '@/features/files/routes';

// 子窗口/低频页面使用动态导入，减少首屏 JS 体积
const ContactsPage = () => import('@/features/chat/presentation/patchbay/contacts/ContactsPage.vue');
const SavedMessagesPage = () => import('@/features/chat/message-flow/bookmark/presentation/SavedMessagesPage.vue');
const ChannelInfoPopoverView = () => import('@/features/chat/presentation/channel-info/ChannelInfoPopoverView.vue');
const UserPopoverPage = () => import('@/features/account/current-user/presentation/pages/UserPopoverPage.vue');
const TrayNotificationPopover = () => import('@/features/tray-notification/presentation/pages/TrayNotificationPopover.vue');

// 截图遮罩窗口
import ScreenshotOverlayRoutes from '@/features/screenshot/routes';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/chat' },
    // 核心页面 —— 较快展示
    { path: '/chat', component: ChatMainPage, name: 'chat' },
    { path: '/login', component: LoginPage, name: 'login' },
    { path: '/required-setup', component: RequiredSetupPage, name: 'required-setup' },
    { path: '/user-info', component: UserInfoPage, name: 'user-info' },
    // 功能页面
    { path: '/servers', component: ServerManagerPage, name: 'servers' },
    { path: '/settings', component: SettingsPage, name: 'settings' },
    { path: '/settings/emoji', component: EmojiManagePage, name: 'settings-emoji' },
    { path: '/plugins', component: PluginCenterPage, name: 'plugins' },
    { path: '/plugins/domain-catalog', component: DomainCatalogPage, name: 'domain-catalog' },
    { path: '/plugins/detail/:pluginId', component: PluginDetailPage, name: 'plugin-detail' },
    { path: '/files', component: FileManagerPage, name: 'files' },
    { path: '/contacts', component: ContactsPage, name: 'contacts' },
    { path: '/saved-messages', component: SavedMessagesPage, name: 'saved-messages' },
    { path: '/channel-info', component: ChannelInfoPage, name: 'channel-info' },
    { path: '/channel-members', component: ChannelMembersPage, name: 'channel-members' },
    { path: '/channel-applications', component: JoinApplicationsPage, name: 'channel-applications' },
    { path: '/channel-bans', component: ChannelBansPage, name: 'channel-bans' },
    // 子窗口 / 弹窗路由 —— 用户触发时才加载
    { path: '/channel-info-popover', component: ChannelInfoPopoverView, name: 'channel-info-popover' },
    { path: '/user-info-popover', component: UserPopoverPage, name: 'user-info-popover' },
    { path: '/tray-notification-popover', component: TrayNotificationPopover, name: 'tray-notification-popover' },
    // 截图遮罩窗口
    ...ScreenshotOverlayRoutes,
    // catch-all 兜底
    { path: '/:pathMatch(.*)*', redirect: '/chat' },
  ],
});

export { router };

