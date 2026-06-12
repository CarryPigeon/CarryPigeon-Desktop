/**
 * @fileoverview tray-notification 端口接口。
 * @description 定义托盘通知所需的全部外部依赖端口，由 data/ 层实现。
 */

import type { ScreenPosition, DesktopNotificationParams, UnreadPreview } from "./model";

/** 托盘图标闪烁控制 */
export interface TrayFlashingPort {
  setFlashing(hasUnread: boolean): Promise<void>;
  clearFlashing(): Promise<void>;
}

/** 托盘菜单语言 */
export interface TrayLocalePort {
  setLocale(locale: string): Promise<void>;
}

/** 弹窗窗口控制 */
export interface TrayPopoverPort {
  openPopover(position: ScreenPosition, previews: UnreadPreview[]): Promise<void>;
  closePopover(): Promise<void>;
}

/** 桌面通知发送 */
export interface DesktopNotificationPort {
  send(params: DesktopNotificationParams): Promise<void>;
}

/** 托盘通知所需的全部端口集合 */
export interface TrayNotificationPorts {
  flashing: TrayFlashingPort;
  locale: TrayLocalePort;
  popover: TrayPopoverPort;
  desktopNotification: DesktopNotificationPort;
}
