/**
 * @fileoverview notification-preferences api contract
 * @description 免打扰模式｜API 类型定义。
 */

import type { ChannelNotificationPreferenceWire, NotificationPreferencesWire, ServerNotificationPreferenceWire } from "./api-types";

export type ChatNotificationPreferenceApi = {
  getPreferences(serverSocket: string, accessToken: string): Promise<NotificationPreferencesWire>;
  setServerPreference(serverSocket: string, accessToken: string, req: ServerNotificationPreferenceWire): Promise<void>;
  setChannelPreference(serverSocket: string, accessToken: string, cid: string, req: ChannelNotificationPreferenceWire): Promise<void>;
};
