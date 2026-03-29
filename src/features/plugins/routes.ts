/**
 * @fileoverview plugins feature public route entries.
 * @description
 * app/router 只能通过本文件引用 plugins 相关页面。
 */

export const PluginCenterPage = () => import("./presentation/pages/PluginCenterPage.vue");
export const DomainCatalogPage = () => import("./presentation/pages/DomainCatalogPage.vue");
export const PluginDetailPage = () => import("./presentation/pages/PluginDetailPage.vue");
