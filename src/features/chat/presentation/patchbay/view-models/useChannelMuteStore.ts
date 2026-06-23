/**
 * @fileoverview useChannelMuteStore.ts
 * @description chat｜频道通知级别状态管理：从服务端同步并本地乐观更新。
 */

import { ref, type Ref } from "vue";
import { createLogger } from "@/shared/utils/logger";
import type { ChatNotificationPreferenceApi } from "@/features/chat/notification-preferences/api";
import { createHttpNotificationPreferenceApi } from "@/features/chat/notification-preferences/data/httpNotificationPreferenceApi";

const logger = createLogger("channelMuteStore");

export type NotificationLevel = "all" | "mentions_only" | "muted";

export type ChannelMuteStore = {
  /** 频道通知级别映射 */
  channelLevels: Ref<Map<string, NotificationLevel>>;
  /** 查询指定频道是否已静音（等效于 level === "muted"） */
  isMuted(channelId: string): boolean;
  /** 查询指定频道的通知级别 */
  getNotificationLevel(channelId: string): NotificationLevel;
  /** 设置指定频道的通知级别，乐观更新 */
  setNotificationLevel(
    channelId: string,
    level: NotificationLevel,
    serverSocket: string,
    accessToken: string,
  ): Promise<void>;
  /** 切换指定频道的静音状态（muted ↔ all），乐观更新 */
  toggleMute(
    channelId: string,
    serverSocket: string,
    accessToken: string,
  ): Promise<void>;
  /** 从服务端拉取当前通知偏好，更新 channelLevels */
  refresh(serverSocket: string, accessToken: string): Promise<void>;
};

/**
 * 创建频道通知级别状态管理 store。
 *
 * 单例模式：整个 patchbay 共享同一份状态。
 */
let storeInstance: ChannelMuteStore | null = null;

export function useChannelMuteStore(): ChannelMuteStore {
  if (storeInstance) return storeInstance;

  const api: ChatNotificationPreferenceApi = createHttpNotificationPreferenceApi();
  const channelLevels = ref(new Map<string, NotificationLevel>());

  function isMuted(channelId: string): boolean {
    return channelLevels.value.get(channelId) === "muted";
  }

  function getNotificationLevel(channelId: string): NotificationLevel {
    return channelLevels.value.get(channelId) ?? "all";
  }

  async function refresh(
    serverSocket: string,
    accessToken: string,
  ): Promise<void> {
    if (!serverSocket || !accessToken) return;
    try {
      const prefs = await api.getPreferences(serverSocket, accessToken);
      const levels = new Map<string, NotificationLevel>();
      for (const ch of prefs.channels) {
        if (ch.mode === "muted" || ch.mode === "mentions_only" || ch.mode === "all") {
          levels.set(ch.cid, ch.mode);
        }
      }
      channelLevels.value = levels;
    } catch (error) {
      logger.warn("Action: chat_channel_mute_refresh_failed", {
        error: String(error),
      });
    }
  }

  async function setNotificationLevel(
    channelId: string,
    level: NotificationLevel,
    serverSocket: string,
    accessToken: string,
  ): Promise<void> {
    if (!channelId || !serverSocket || !accessToken) return;

    const prev = new Map(channelLevels.value);
    channelLevels.value = new Map(channelLevels.value).set(channelId, level);

    try {
      await api.setChannelPreference(serverSocket, accessToken, channelId, {
        mode: level,
      });
    } catch (error) {
      channelLevels.value = prev;
      logger.error("Action: chat_channel_notification_level_set_failed", {
        channelId,
        level,
        error: String(error),
      });
      throw error;
    }
  }

  async function toggleMute(
    channelId: string,
    serverSocket: string,
    accessToken: string,
  ): Promise<void> {
    const current = getNotificationLevel(channelId);
    const next: NotificationLevel = current === "muted" ? "all" : "muted";
    await setNotificationLevel(channelId, next, serverSocket, accessToken);
  }

  storeInstance = {
    channelLevels,
    isMuted,
    getNotificationLevel,
    setNotificationLevel,
    toggleMute,
    refresh,
  };

  return storeInstance;
}
