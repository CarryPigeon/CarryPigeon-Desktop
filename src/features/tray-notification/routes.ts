/**
 * @fileoverview tray-notification feature 路由出口。
 * @description 提供托盘通知弹窗页面的懒加载入口。
 */

export const TrayNotificationPopover = () =>
  import("./presentation/pages/TrayNotificationPopover.vue");
