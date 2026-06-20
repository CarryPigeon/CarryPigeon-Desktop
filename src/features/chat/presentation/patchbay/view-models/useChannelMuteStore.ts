/**
 * @fileoverview useChannelMuteStore.ts
 * @description chat｜频道静音状态管理：从服务端同步并本地乐观更新。
 */

import { ref, type Ref } from "vue";
import { createLogger } from "@/shared/utils/logger";
import type { ChatNotificationPreferenceApi } from "@/features/chat/notification-preferences/api";
import { createHttpNotificationPreferenceApi } from "@/features/chat/notification-preferences/data/httpNotificationPreferenceApi";

const logger = createLogger("channelMuteStore");

export type ChannelMuteStore = {
  /** 当前已静音的频道 id 集合 */
  mutedChannelIds: Ref<Set<string>>;
  /** 查询指定频道是否已静音 */
  isMuted(channelId: string): boolean;
  /** 切换指定频道的静音状态（muted ↔ all），乐观更新 */
  toggleMute(
    channelId: string,
    serverSocket: string,
    accessToken: string,
  ): Promise<void>;
  /** 从服务端拉取当前通知偏好，更新 mutedChannelIds */
  refresh(serverSocket: string, accessToken: string): Promise<void>;
};

/**
 * 创建频道静音状态管理 store。
 *
 * 单例模式：整个 patchbay 共享同一份 mute 状态。
 */
let storeInstance: ChannelMuteStore | null = null;

export function useChannelMuteStore(): ChannelMuteStore {
  if (storeInstance) return storeInstance;

  const api: ChatNotificationPreferenceApi = createHttpNotificationPreferenceApi();
  const mutedChannelIds = ref(new Set<string>());

  function isMuted(channelId: string): boolean {
    return mutedChannelIds.value.has(channelId);
  }

  async function refresh(
    serverSocket: string,
    accessToken: string,
  ): Promise<void> {
    if (!serverSocket || !accessToken) return;
    try {
      const prefs = await api.getPreferences(serverSocket, accessToken);
      const muted = new Set<string>();
      for (const ch of prefs.channels) {
        if (ch.mode === "muted") {
          muted.add(ch.cid);
        }
      }
      mutedChannelIds.value = muted;
    } catch (error) {
      logger.warn("Action: chat_channel_mute_refresh_failed", {
        error: String(error),
      });
    }
  }

  async function toggleMute(
    channelId: string,
    serverSocket: string,
    accessToken: string,
  ): Promise<void> {
    if (!channelId || !serverSocket || !accessToken) return;

    const currentlyMuted = isMuted(channelId);
    const nextMode = currentlyMuted ? "all" : "muted";

    // 乐观更新
    const prev = new Set(mutedChannelIds.value);
    if (currentlyMuted) {
      mutedChannelIds.value.delete(channelId);
    } else {
      mutedChannelIds.value.add(channelId);
    }
    // 触发响应式更新
    mutedChannelIds.value = new Set(mutedChannelIds.value);

    try {
      await api.setChannelPreference(serverSocket, accessToken, channelId, {
        mode: nextMode,
      });
    } catch (error) {
      // 失败回滚
      mutedChannelIds.value = prev;
      logger.error("Action: chat_channel_mute_toggle_failed", {
        channelId,
        error: String(error),
      });
      throw error;
    }
  }

  storeInstance = {
    mutedChannelIds,
    isMuted,
    toggleMute,
    refresh,
  };

  return storeInstance;
}
