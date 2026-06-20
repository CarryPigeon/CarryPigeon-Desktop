/**
 * @fileoverview 频道右键菜单编排：菜单状态、动作分发。
 * @description chat｜presentation composable：统一频道右键菜单行为。
 */

import { ref } from "vue";

export type ChannelContextAction = "mute" | "unmute" | "channel_info" | "mark_read";

export type UseChannelContextMenuDeps = {
  isMuted(channelId: string): boolean;
  toggleMute(channelId: string): Promise<void>;
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

  function currentAction(): "mute" | "unmute" {
    return deps.isMuted(menuChannelId.value) ? "unmute" : "mute";
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
    currentAction,
  };
}
