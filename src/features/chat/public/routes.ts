/**
 * @fileoverview chat feature public route entries.
 * @description
 * app/router 只能通过本文件引用 chat 相关页面。
 */

export const ChatMainPage = () => import("../presentation/pages/MainPage.vue");
export const ChannelInfoPage = () => import("../presentation/pages/ChannelInfoPage.vue");
export const ChannelInfoPopoverView = () => import("../presentation/pages/ChannelInfoPopoverView.vue");
export const ChannelMembersPage = () => import("../room-governance/presentation/pages/ChannelMembersPage.vue");
export const JoinApplicationsPage = () => import("../room-governance/presentation/pages/JoinApplicationsPage.vue");
export const ChannelBansPage = () => import("../room-governance/presentation/pages/ChannelBansPage.vue");
