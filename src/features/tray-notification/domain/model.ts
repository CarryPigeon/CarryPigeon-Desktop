/**
 * @fileoverview tray-notification 领域模型。
 * @description 托盘通知相关的纯业务类型，不依赖 Vue/Tauri/浏览器 API。
 */

/** 弹窗屏幕位置 */
export interface ScreenPosition {
  x: number;
  y: number;
}

/** 桌面通知参数 */
export interface DesktopNotificationParams {
  title: string;
  body: string;
  channelId: string;
  messageId: string;
}

/** 未读消息预览项（从 chat 公共类型获取） */
export interface UnreadPreview {
  messageId: string;
  senderName: string;
  textPreview: string;
  channelName: string;
  channelId: string;
  timeMs: number;
  mentionedMe?: boolean;
}

/** 托盘交互状态快照（不可变 plain object） */
export interface TrayStateSnapshot {
  hasUnread: boolean;
  isFlashing: boolean;
  popoverOpen: boolean;
  unreadPreviewCount: number;
}

/** 通知决策上下文 */
export interface NotificationContext {
  isAppFocused: boolean;
  notificationPreference: "all" | "mentions_only" | "muted";
  hasMention: boolean;
  isCurrentChannel: boolean;
}

/** 通知决策结果 */
export interface NotificationDecision {
  shouldNotify: boolean;
  reason?: "disabled_in_settings" | "window_focused" | "current_channel" | "channel_muted" | "mentions_only";
}

/**
 * 桌面通知决策策略（纯函数）。
 *
 * 降级链（任一条件命中则跳过）：
 * 1. 窗口处于聚焦状态
 * 2. 消息来自当前正在查看的频道
 * 3. 频道被静音（muted）
 * 4. 频道设为仅@提及，且当前消息未提及当前用户
 */
export function decideNotification(ctx: NotificationContext): NotificationDecision {
  if (ctx.isAppFocused) return { shouldNotify: false, reason: "window_focused" };
  if (ctx.isCurrentChannel) return { shouldNotify: false, reason: "current_channel" };
  if (ctx.notificationPreference === "muted") return { shouldNotify: false, reason: "channel_muted" };
  if (ctx.notificationPreference === "mentions_only" && !ctx.hasMention) {
    return { shouldNotify: false, reason: "mentions_only" };
  }
  return { shouldNotify: true };
}
