/**
 * @fileoverview notification-preferences api types
 * @description 免打扰模式｜通知偏好 wire types。
 */

export type NotificationMode = "all" | "mentions_only" | "muted";
export type NotificationServerMode = "all" | "mentions_only" | "muted";

export type NotificationPreferencesWire = {
  server: {
    mode: NotificationServerMode;
    muted_until?: number;
  };
  channels: Array<{
    cid: string;
    mode: NotificationMode | "inherit";
    muted_until?: number;
  }>;
};

export type ServerNotificationPreferenceWire = {
  mode: NotificationServerMode;
  muted_until?: number;
};

export type ChannelNotificationPreferenceWire = {
  mode: NotificationMode | "inherit";
  muted_until?: number;
};
