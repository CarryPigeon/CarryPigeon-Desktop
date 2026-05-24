/**
 * @fileoverview ServerRail model
 * @description 收敛 ServerRail 所需的 DND 免打扰交互状态，保持布局组件仅消费 props/emit。
 */

import { computed, onMounted, type ComputedRef } from "vue";
import { createNotificationPreferenceCapability } from "@/features/chat/notification-preferences/capability-source";
import { createHttpNotificationPreferenceApi } from "@/features/chat/notification-preferences/data/httpNotificationPreferenceApi";
import { currentServerSocket } from "@/features/server-connection/api";
import { readAuthToken } from "@/shared/utils/localState";

export type UseServerRailModelDeps = {
  currentAccessToken?: string;
};

export type ServerRailModel = {
  serverMuted: ComputedRef<boolean>;
  toggleServerMute(): Promise<void>;
};

export function useServerRailModel(deps?: UseServerRailModelDeps): ServerRailModel {
  const notifPrefApi = createHttpNotificationPreferenceApi();
  const notifPrefCapability = createNotificationPreferenceCapability(notifPrefApi, () => ({
    serverSocket: currentServerSocket.value ?? "",
    accessToken: deps?.currentAccessToken ?? readAuthToken(currentServerSocket.value ?? "") ?? "",
  }));

  const serverMuted = computed(() => notifPrefCapability.mode.value === "muted");

  onMounted(() => {
    notifPrefCapability.refresh();
  });

  async function toggleServerMute(): Promise<void> {
    await notifPrefCapability.toggleServerMute();
  }

  return { serverMuted, toggleServerMute };
}
