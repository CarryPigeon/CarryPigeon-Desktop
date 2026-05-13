/**
 * @fileoverview 托盘未读闪烁 bridge。
 * @description
 * 监听 chat 公共能力中的未读总数，并把"是否存在未读"同步到 Rust 托盘状态机。
 */

import { watch, type WatchStopHandle } from "vue";
import { getChatCapabilities } from "@/features/chat/public/api";
import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";
import { isTauriRuntimeAvailable } from "@/shared/tauri/runtime";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("trayUnreadBridge");

/**
 * 注册主窗口托盘未读状态同步。
 */
export function registerTrayUnreadBridge(): WatchStopHandle | null {
  if (!isTauriRuntimeAvailable()) return null;

  const chat = getChatCapabilities();
  let lastState: boolean | null = null;

  return watch(
    () => chat.session.directory.totalUnreadCount.value > 0,
    (hasUnread) => {
      if (hasUnread === lastState) return;
      lastState = hasUnread;
      void setTrayUnreadFlashing(hasUnread);
    },
    { immediate: true },
  );
}

/**
 * 尽力恢复托盘普通图标。
 */
export function clearTrayUnreadFlashing(): void {
  if (!isTauriRuntimeAvailable()) return;
  void setTrayUnreadFlashing(false);
}

async function setTrayUnreadFlashing(hasUnread: boolean): Promise<void> {
  try {
    await invokeTauri<void>(TAURI_COMMANDS.setTrayUnreadFlashing, { hasUnread });
  } catch (error) {
    logger.warn("Action: app_tray_unread_state_sync_failed", { error: String(error), hasUnread });
  }
}
