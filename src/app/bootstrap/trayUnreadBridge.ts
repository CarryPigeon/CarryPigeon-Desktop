/**
 * @fileoverview 托盘未读闪烁 bridge。
 * @description
 * 监听 chat 公共能力中的未读总数，并把"是否存在未读"同步到 Rust 托盘状态机。
 * chat 能力通过动态 import 延迟加载，避免启动时急切拉取 chat 子域。
 */

import { watch, type WatchStopHandle } from "vue";
import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";
import { isTauriRuntimeAvailable } from "@/shared/tauri/runtime";
import { IS_MOCK_ENABLED } from "@/shared/config/runtime";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("trayUnreadBridge");

let chatPromise: Promise<unknown> | null = null;

async function getChatLazy() {
  if (!chatPromise) {
    chatPromise = import("@/features/chat/public/api").then((m) => m.getChatCapabilities());
  }
  return chatPromise;
}

/**
 * 注册主窗口托盘未读状态同步。
 */
export function registerTrayUnreadBridge(): WatchStopHandle | null {
  if (!isTauriRuntimeAvailable() || IS_MOCK_ENABLED) return null;

  let lastState: boolean | null = null;
  let innerStop: WatchStopHandle | null = null;

  void getChatLazy().then((raw) => {
    const chat = raw as { session: { directory: { totalUnreadCount: { value: number } } } };
    innerStop = watch(
      () => chat.session.directory.totalUnreadCount.value > 0,
      (hasUnread) => {
        if (hasUnread === lastState) return;
        lastState = hasUnread;
        void setTrayUnreadFlashing(hasUnread);
      },
      { immediate: true },
    );
  });

  return () => {
    innerStop?.();
  };
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
    logger.warn("Action: chat_tray_unread_state_sync_failed", { error: String(error), hasUnread });
  }
}
