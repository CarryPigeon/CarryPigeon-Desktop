/**
 * @fileoverview account feature public route entries.
 * @description
 * app/router 只能通过本文件引用 account 相关页面。
 */

export const LoginPage = () => import("./auth-flow/presentation/pages/LoginPage.vue");
export const RequiredSetupPage = () => import("./auth-flow/presentation/pages/RequiredSetupPage.vue");
export const UserInfoPage = () => import("./profile/presentation/pages/UserInfoPage.vue");
export const UserPopoverPage = () => import("./current-user/presentation/pages/UserPopoverPage.vue");
