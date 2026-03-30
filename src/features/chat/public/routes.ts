/**
 * @fileoverview chat feature public route entries.
 * @description
 * app/router 只能通过本文件引用 chat 相关页面。
 */

/**
 * chat 主页面路由组件。
 */
export const ChatMainPage = () => import("../presentation/patchbay/page/MainPage.vue");
/**
 * 频道信息页面路由组件。
 */
export const ChannelInfoPage = () => import("../presentation/channel-info/ChannelInfoPage.vue");
/**
 * 频道信息浮层视图路由组件。
 */
export const ChannelInfoPopoverView = () => import("../presentation/channel-info/ChannelInfoPopoverView.vue");
/**
 * 频道成员治理页面路由组件。
 */
export const ChannelMembersPage = () => import("../room-governance/presentation/pages/ChannelMembersPage.vue");
/**
 * 入群申请治理页面路由组件。
 */
export const JoinApplicationsPage = () => import("../room-governance/presentation/pages/JoinApplicationsPage.vue");
/**
 * 频道封禁治理页面路由组件。
 */
export const ChannelBansPage = () => import("../room-governance/presentation/pages/ChannelBansPage.vue");
