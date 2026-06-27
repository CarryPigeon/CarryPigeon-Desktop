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

/**
 * 定时免打扰预设毫秒值。`0` 表示「直至手动取消」。
 */
export type MuteDurationPreset = number;

export const MUTE_DURATION_1H: MuteDurationPreset = 60 * 60 * 1000;
export const MUTE_DURATION_8H: MuteDurationPreset = 8 * 60 * 60 * 1000;
export const MUTE_DURATION_24H: MuteDurationPreset = 24 * 60 * 60 * 1000;
export const MUTE_DURATION_FOREVER: MuteDurationPreset = 0;

export type ChannelMuteStore = {
  /** 频道通知级别映射 */
  channelLevels: Ref<Map<string, NotificationLevel>>;
  /** 频道定时静音到期时间映射（epoch ms，`undefined` 表示非定时或非静音） */
  channelMutedUntil: Ref<Map<string, number>>;
  /** 查询指定频道是否已静音（等效于 level === "muted" 且 mutedUntil 未到期或永久） */
  isMuted(channelId: string): boolean;
  /** 查询指定频道的通知级别 */
  getNotificationLevel(channelId: string): NotificationLevel;
  /** 查询指定频道的定时静音到期时间（epoch ms），未设置时为 `undefined`。 */
  getMutedUntil(channelId: string): number | undefined;
  /**
   * 设置指定频道的通知级别，乐观更新。
   * `mutedUntilMs` 为 `undefined` 时清除定时；为数字时表示该频道静音到期时间。
   */
  setNotificationLevel(
    channelId: string,
    level: NotificationLevel,
    serverSocket: string,
    accessToken: string,
    mutedUntilMs?: number | null,
  ): Promise<void>;
  /**
   * 定时静音指定频道。`durationMs <= 0` 表示永久静音。
   */
  setNotificationLevelForDuration(
    channelId: string,
    level: NotificationLevel,
    durationMs: number,
    serverSocket: string,
    accessToken: string,
  ): Promise<void>;
  /** 切换指定频道的静音状态（muted ↔ all），乐观更新 */
  toggleMute(
    channelId: string,
    serverSocket: string,
    accessToken: string,
  ): Promise<void>;
  /** 从服务端拉取当前通知偏好，更新 channelLevels / channelMutedUntil */
  refresh(serverSocket: string, accessToken: string): Promise<void>;
  /**
   * 到期检查：若某频道 mutedUntil 已过则本地重置为 all 并返回。
   * 供 UI 周期性调用以驱动自动恢复。
   */
  reapExpiredMutes(nowMs: number): string[];
};

/**
 * 判断指定频道是否仍处于"有效"静音状态。
 *
 * @param level - 通知级别。
 * @param mutedUntil - 静音到期时间（epoch ms），`undefined` 表示永久。
 * @param nowMs - 当前时间（epoch ms）。
 * @returns 是否仍处于静音状态。
 */
function isMuteActive(level: NotificationLevel, mutedUntil: number | undefined, nowMs: number): boolean {
  if (level !== "muted") return false;
  if (mutedUntil === undefined) return true;
  return mutedUntil > nowMs;
}

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
  const channelMutedUntil = ref(new Map<string, number>());

  function isMuted(channelId: string): boolean {
    return channelLevels.value.get(channelId) === "muted";
  }

  function getNotificationLevel(channelId: string): NotificationLevel {
    return channelLevels.value.get(channelId) ?? "all";
  }

  function getMutedUntil(channelId: string): number | undefined {
    return channelMutedUntil.value.get(channelId);
  }

  async function refresh(
    serverSocket: string,
    accessToken: string,
  ): Promise<void> {
    if (!serverSocket || !accessToken) return;
    try {
      const prefs = await api.getPreferences(serverSocket, accessToken);
      const levels = new Map<string, NotificationLevel>();
      const untils = new Map<string, number>();
      for (const ch of prefs.channels) {
        if (ch.mode === "muted" || ch.mode === "mentions_only" || ch.mode === "all") {
          levels.set(ch.cid, ch.mode);
          if (ch.muted_until !== undefined && typeof ch.muted_until === "number") {
            untils.set(ch.cid, ch.muted_until);
          }
        }
      }
      channelLevels.value = levels;
      channelMutedUntil.value = untils;
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
    mutedUntilMs?: number | null,
  ): Promise<void> {
    if (!channelId || !serverSocket || !accessToken) return;

    const prevLevels = new Map(channelLevels.value);
    const prevUntils = new Map(channelMutedUntil.value);
    const nextLevels = new Map(channelLevels.value).set(channelId, level);
    const nextUntils = new Map(channelMutedUntil.value);
    if (mutedUntilMs === null || mutedUntilMs === undefined) {
      nextUntils.delete(channelId);
    } else if (typeof mutedUntilMs === "number" && Number.isFinite(mutedUntilMs)) {
      nextUntils.set(channelId, mutedUntilMs);
    }
    channelLevels.value = nextLevels;
    channelMutedUntil.value = nextUntils;

    const wireMutedUntil = mutedUntilMs === null || mutedUntilMs === undefined
      ? undefined
      : mutedUntilMs;

    try {
      await api.setChannelPreference(serverSocket, accessToken, channelId, {
        mode: level,
        ...(wireMutedUntil !== undefined ? { muted_until: wireMutedUntil } : {}),
      });
    } catch (error) {
      channelLevels.value = prevLevels;
      channelMutedUntil.value = prevUntils;
      logger.error("Action: chat_channel_notification_level_set_failed", {
        channelId,
        level,
        error: String(error),
      });
      throw error;
    }
  }

  async function setNotificationLevelForDuration(
    channelId: string,
    level: NotificationLevel,
    durationMs: number,
    serverSocket: string,
    accessToken: string,
  ): Promise<void> {
    const mutedUntilMs = durationMs > 0 ? Date.now() + durationMs : null;
    await setNotificationLevel(channelId, level, serverSocket, accessToken, mutedUntilMs);
  }

  async function toggleMute(
    channelId: string,
    serverSocket: string,
    accessToken: string,
  ): Promise<void> {
    const current = getNotificationLevel(channelId);
    const next: NotificationLevel = current === "muted" ? "all" : "muted";
    await setNotificationLevel(channelId, next, serverSocket, accessToken, null);
  }

  function reapExpiredMutes(nowMs: number): string[] {
    const expired: string[] = [];
    const nextLevels = new Map(channelLevels.value);
    const nextUntils = new Map(channelMutedUntil.value);
    for (const [cid, until] of channelMutedUntil.value) {
      if (until <= nowMs) {
        nextLevels.set(cid, "all");
        nextUntils.delete(cid);
        expired.push(cid);
      }
    }
    if (expired.length > 0) {
      channelLevels.value = nextLevels;
      channelMutedUntil.value = nextUntils;
    }
    return expired;
  }

  storeInstance = {
    channelLevels,
    channelMutedUntil,
    isMuted,
    getNotificationLevel,
    getMutedUntil,
    setNotificationLevel,
    setNotificationLevelForDuration,
    toggleMute,
    refresh,
    reapExpiredMutes,
  };

  return storeInstance;
}

export { isMuteActive };
