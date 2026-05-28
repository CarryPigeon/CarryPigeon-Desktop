/**
 * @fileoverview 桌面通知决策器。
 * @description
 * 根据当前窗口聚焦状态、频道上下文与用户偏好，判断是否需要弹出桌面通知。
 * 纯函数，无副作用，不依赖任何框架或 Tauri API。
 */

import type { NotificationMode } from "@/features/chat/notification-preferences/api-types";

export type NotificationDecision = {
  shouldNotify: boolean;
  reason?: "disabled_in_settings" | "window_focused" | "current_channel" | "channel_muted" | "mentions_only";
};

/**
 * 决定是否应发送桌面通知。
 *
 * 降级链（任一条件命中则跳过）：
 * 1. 全局通知开关关闭
 * 2. 窗口处于聚焦状态
 * 3. 消息来自当前正在查看的频道
 * 4. 频道被静音（muted）
 * 5. 频道设为仅@提及，且当前消息未提及当前用户
 */
export function decideNotification(params: {
  desktopNotificationsEnabled: boolean;
  isWindowFocused: boolean;
  messageChannelId: string;
  currentChannelId: string;
  notificationPreference: NotificationMode;
  isMentioned: boolean;
}): NotificationDecision {
  if (!params.desktopNotificationsEnabled) return { shouldNotify: false, reason: "disabled_in_settings" };
  if (params.isWindowFocused) return { shouldNotify: false, reason: "window_focused" };
  if (params.messageChannelId === params.currentChannelId) return { shouldNotify: false, reason: "current_channel" };
  if (params.notificationPreference === "muted") return { shouldNotify: false, reason: "channel_muted" };
  if (params.notificationPreference === "mentions_only" && !params.isMentioned) return { shouldNotify: false, reason: "mentions_only" };
  return { shouldNotify: true };
}
