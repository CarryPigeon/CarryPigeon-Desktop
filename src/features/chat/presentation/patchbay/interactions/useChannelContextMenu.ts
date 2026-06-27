/**
 * @fileoverview 频道右键菜单编排：菜单状态、动作分发。
 * @description chat｜presentation composable：统一频道右键菜单行为。
 */

import { ref } from "vue";
import type { NotificationLevel } from "../view-models/useChannelMuteStore";

export type ChannelContextAction =
  | "mute"
  | "unmute"
  | "channel_info"
  | "mark_read"
  | `level:${NotificationLevel}`
  | `mute_for:${number}`;

export type UseChannelContextMenuDeps = {
  isMuted(channelId: string): boolean;
  getNotificationLevel(channelId: string): NotificationLevel;
  toggleMute(channelId: string): Promise<void>;
  setNotificationLevel(channelId: string, level: NotificationLevel, serverSocket: string, accessToken: string): Promise<void>;
  /**
   * 定时静音指定频道。`durationMs <= 0` 表示永久静音。
   */
  setNotificationLevelForDuration(channelId: string, level: NotificationLevel, durationMs: number): Promise<void>;
  openChannelInfo(channelId: string): void;
  markChannelRead?(channelId: string): void;
};

export function useChannelContextMenu(deps: UseChannelContextMenuDeps) {
  const menuOpen = ref(false);
  const menuX = ref(0);
  const menuY = ref(0);
  const menuChannelId = ref<string>("");

  function openMenuForChannel(e: MouseEvent, channelId: string): void {
    e.preventDefault();
    menuChannelId.value = channelId;
    menuX.value = e.clientX;
    menuY.value = e.clientY;
    menuOpen.value = true;
  }

  function closeMenu(): void {
    menuOpen.value = false;
  }

  function currentNotifLevel(): NotificationLevel {
    return deps.getNotificationLevel(menuChannelId.value);
  }

  async function handleMenuAction(action: ChannelContextAction): Promise<void> {
    const channelId = menuChannelId.value;
    if (!channelId) return;
    closeMenu();

    switch (action) {
      case "mute":
      case "unmute":
        await deps.toggleMute(channelId);
        break;
      case "channel_info":
        deps.openChannelInfo(channelId);
        break;
      case "mark_read":
        deps.markChannelRead?.(channelId);
        break;
      default:
        if (action.startsWith("level:")) {
          const level = action.slice(6) as NotificationLevel;
          await deps.setNotificationLevel(channelId, level, "", "");
        } else if (action.startsWith("mute_for:")) {
          const durationMs = Number.parseInt(action.slice(9), 10);
          if (Number.isFinite(durationMs)) {
            await deps.setNotificationLevelForDuration(channelId, "muted", durationMs);
          }
        }
        break;
    }
  }

  return {
    menuOpen,
    menuX,
    menuY,
    menuChannelId,
    openMenuForChannel,
    closeMenu,
    handleMenuAction,
    currentNotifLevel,
  };
}
