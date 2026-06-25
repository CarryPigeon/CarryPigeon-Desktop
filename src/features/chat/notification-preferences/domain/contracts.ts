/**
 * @fileoverview notification-preferences 领域契约。
 * @description
 * 通知偏好（免打扰模式）子域的领域模型，与传输层无关。
 */

export type NotificationMode = "all" | "mentions_only" | "muted";
export type NotificationServerMode = "all" | "mentions_only" | "muted";

export type NotificationPreferences = {
  server: {
    mode: NotificationServerMode;
    mutedUntil?: number;
  };
  channels: Array<{
    channelId: string;
    mode: NotificationMode | "inherit";
    mutedUntil?: number;
  }>;
};

export type ServerNotificationPreference = {
  mode: NotificationServerMode;
  mutedUntil?: number;
};

export type ChannelNotificationPreference = {
  mode: NotificationMode | "inherit";
  mutedUntil?: number;
};
