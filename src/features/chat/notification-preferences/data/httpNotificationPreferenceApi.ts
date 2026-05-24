/**
 * @fileoverview httpNotificationPreferenceApi.ts
 * @description 免打扰模式｜HTTP 实现。
 */

import { createAuthedHttpJsonClient } from "@/shared/net/http/authedHttpJsonClient";
import type { ChatNotificationPreferenceApi } from "../api";
import type { NotificationPreferencesWire } from "../api-types";

export function createHttpNotificationPreferenceApi(): ChatNotificationPreferenceApi {
  return {
    async getPreferences(serverSocket, accessToken) {
      const client = createAuthedHttpJsonClient(serverSocket, accessToken);
      return client.requestJson<NotificationPreferencesWire>("GET", "/notification_preferences");
    },
    async setServerPreference(serverSocket, accessToken, req) {
      const client = createAuthedHttpJsonClient(serverSocket, accessToken);
      await client.requestJson<void>("PUT", "/notification_preferences/server", req);
    },
    async setChannelPreference(serverSocket, accessToken, cid, req) {
      const client = createAuthedHttpJsonClient(serverSocket, accessToken);
      const channelId = String(cid).trim();
      if (!channelId) throw new Error("Missing cid");
      await client.requestJson<void>("PUT", `/channels/${encodeURIComponent(channelId)}/notification_preference`, req);
    },
  };
}
