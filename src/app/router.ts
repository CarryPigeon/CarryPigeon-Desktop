import { createRouter, createWebHistory } from 'vue-router';
import { LoginPage, RequiredSetupPage, UserInfoPage, UserPopoverPage } from '@/features/account/routes';
import { ChatMainPage, ChannelInfoPage, ChannelInfoPopoverView, ChannelMembersPage, JoinApplicationsPage, ChannelBansPage } from '@/features/chat/public/routes';
import { PluginCenterPage, DomainCatalogPage, PluginDetailPage } from '@/features/plugins/routes';
import { SettingsPage, EmojiManagePage } from '@/features/settings/routes';
const ContactsPage = () => import('@/features/chat/presentation/patchbay/contacts/ContactsPage.vue');
import { ServerManagerPage } from '@/features/server-connection/routes';
import { FileManagerPage } from '@/features/files/routes';
import { TrayNotificationPopover } from '@/features/tray-notification/routes';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/chat' },
    { path: '/chat', component: ChatMainPage, name: 'chat' },
    { path: '/login', component: LoginPage, name: 'login' },
    { path: '/required-setup', component: RequiredSetupPage, name: 'required-setup' },
    { path: '/user-info', component: UserInfoPage, name: 'user-info' },
    { path: '/servers', component: ServerManagerPage, name: 'servers' },
    { path: '/settings', component: SettingsPage, name: 'settings' },
    { path: '/settings/emoji', component: EmojiManagePage, name: 'settings-emoji' },
    { path: '/plugins', component: PluginCenterPage, name: 'plugins' },
    { path: '/plugins/domain-catalog', component: DomainCatalogPage, name: 'domain-catalog' },
    { path: '/plugins/detail/:pluginId', component: PluginDetailPage, name: 'plugin-detail' },
    { path: '/files', component: FileManagerPage, name: 'files' },
    { path: '/contacts', component: ContactsPage, name: 'contacts' },
    { path: '/channel-info', component: ChannelInfoPage, name: 'channel-info' },
    { path: '/channel-members', component: ChannelMembersPage, name: 'channel-members' },
    { path: '/channel-applications', component: JoinApplicationsPage, name: 'channel-applications' },
    { path: '/channel-bans', component: ChannelBansPage, name: 'channel-bans' },
    // 子窗口路由（保留 subWindowRouting 兼容）
    { path: '/channel-info-popover', component: ChannelInfoPopoverView, name: 'channel-info-popover' },
    { path: '/user-info-popover', component: UserPopoverPage, name: 'user-info-popover' },
    { path: '/tray-notification-popover', component: TrayNotificationPopover, name: 'tray-notification-popover' },
    // catch-all 兜底
    { path: '/:pathMatch(.*)*', redirect: '/chat' },
  ],
});

export { router };

