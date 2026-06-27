/**
 * @fileoverview notification-preferences capability source
 * @description 免打扰模式｜Vue 响应式能力源。
 */

import { ref, type Ref } from "vue";
import type { ChatNotificationPreferenceApi } from "./api";
import type { NotificationServerMode } from "./api-types";

export type NotificationPreferenceCapabilities = {
  mode: Ref<NotificationServerMode>;
  /** 服务端级定时静音到期时间（epoch ms），未设置时为 `null`。 */
  mutedUntil: Ref<number | null>;
  toggleServerMute(): Promise<void>;
  /**
   * 定时切换服务端免打扰。`durationMs <= 0` 表示永久静音；`>0` 表示静音至 `now+durationMs`。
   * `durationMs === undefined` 表示清除定时（永久）。
   */
  toggleServerMuteForDuration(durationMs?: number): Promise<void>;
  /**
   * 主动清除静音定时，恢复为 all。仅在前端 reap 到期时调用。
   */
  clearMutedUntil(): Promise<void>;
  refresh(): Promise<void>;
};

export function createNotificationPreferenceCapability(
  api: ChatNotificationPreferenceApi,
  getScope: () => { serverSocket: string; accessToken: string },
): NotificationPreferenceCapabilities {
  const mode = ref<NotificationServerMode>("all");
  const mutedUntil = ref<number | null>(null);

  async function refresh(): Promise<void> {
    const { serverSocket, accessToken } = getScope();
    if (!serverSocket || !accessToken) return;
    try {
      const prefs = await api.getPreferences(serverSocket, accessToken);
      mode.value = prefs.server.mode;
      mutedUntil.value = typeof prefs.server.muted_until === "number" ? prefs.server.muted_until : null;
    } catch {
      // fail silently
    }
  }

  async function toggleServerMute(): Promise<void> {
    const { serverSocket, accessToken } = getScope();
    if (!serverSocket || !accessToken) return;
    const nextMode: NotificationServerMode = mode.value === "muted" ? "all" : "muted";
    await api.setServerPreference(serverSocket, accessToken, { mode: nextMode });
    mode.value = nextMode;
    if (nextMode === "all") {
      mutedUntil.value = null;
    } else {
      mutedUntil.value = null;
    }
  }

  async function toggleServerMuteForDuration(durationMs?: number): Promise<void> {
    const { serverSocket, accessToken } = getScope();
    if (!serverSocket || !accessToken) return;
    const nextMode: NotificationServerMode = mode.value === "muted" ? "all" : "muted";
    let nextMutedUntil: number | undefined;
    if (nextMode === "muted") {
      if (durationMs === undefined) {
        nextMutedUntil = undefined;
      } else if (durationMs > 0) {
        nextMutedUntil = Date.now() + durationMs;
      } else {
        nextMutedUntil = undefined;
      }
    }
    await api.setServerPreference(serverSocket, accessToken, {
      mode: nextMode,
      ...(nextMutedUntil !== undefined ? { muted_until: nextMutedUntil } : {}),
    });
    mode.value = nextMode;
    mutedUntil.value = nextMutedUntil ?? null;
  }

  async function clearMutedUntil(): Promise<void> {
    const { serverSocket, accessToken } = getScope();
    if (!serverSocket || !accessToken) return;
    if (mode.value !== "muted") return;
    await api.setServerPreference(serverSocket, accessToken, { mode: "all" });
    mode.value = "all";
    mutedUntil.value = null;
  }

  return { mode, mutedUntil, toggleServerMute, toggleServerMuteForDuration, clearMutedUntil, refresh };
}
