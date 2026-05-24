/**
 * @fileoverview notification-preferences capability source
 * @description 免打扰模式｜Vue 响应式能力源。
 */

import { ref, type Ref } from "vue";
import type { ChatNotificationPreferenceApi } from "./api";
import type { NotificationServerMode } from "./api-types";

export type NotificationPreferenceCapabilities = {
  mode: Ref<NotificationServerMode>;
  toggleServerMute(): Promise<void>;
  refresh(): Promise<void>;
};

export function createNotificationPreferenceCapability(
  api: ChatNotificationPreferenceApi,
  getScope: () => { serverSocket: string; accessToken: string },
): NotificationPreferenceCapabilities {
  const mode = ref<NotificationServerMode>("all");

  async function refresh(): Promise<void> {
    const { serverSocket, accessToken } = getScope();
    if (!serverSocket || !accessToken) return;
    try {
      const prefs = await api.getPreferences(serverSocket, accessToken);
      mode.value = prefs.server.mode;
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
  }

  return { mode, toggleServerMute, refresh };
}
