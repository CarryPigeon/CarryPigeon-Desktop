/**
 * @fileoverview 托盘悬停通知桥接模块。
 * @description
 * 监听 Rust 侧 "tray-hover-settled" 事件，收集未读消息预览，
 * 并通过 `open_popover_window` 命令打开通知弹窗。
 * chat 能力通过动态 import 延迟加载，避免启动时急切拉取 chat 子域。
 */

import { listen } from "@tauri-apps/api/event";
import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";
import { isTauriRuntimeAvailable } from "@/shared/tauri/runtime";
import { IS_MOCK_ENABLED } from "@/shared/config/runtime";
import { createLogger } from "@/shared/utils/logger";
import type { UnreadMessagePreview } from "@/features/chat/public/api-types";

const logger = createLogger("trayHoverBridge");

let chatPromise: Promise<unknown> | null = null;

async function getChatLazy() {
  if (!chatPromise) {
    chatPromise = import("@/features/chat/public/api").then((m) => m.getChatCapabilities());
  }
  return chatPromise;
}

/**
 * 注册托盘悬停通知监听。
 *
 * 返回清理函数（可在组件卸载时调用取消监听）。
 */
export function registerTrayHoverBridge(): (() => void) | null {
  if (!isTauriRuntimeAvailable() || IS_MOCK_ENABLED) return null;

  let unlisteners: (() => void)[] = [];

  void getChatLazy().then(async (raw) => {
    const chat = raw as {
      getUnreadMessagePreviews(maxCount: number): UnreadMessagePreview[];
      session: {
        currentChannel: {
          selectChannel(channelId: string): Promise<unknown>;
        };
      };
    };

    const unlistenHover = await listen<{ x: number; y: number }>("tray-hover-settled", async (event) => {
      const previews = chat.getUnreadMessagePreviews(4);
      if (previews.length === 0) return;

      const data = encodeURIComponent(JSON.stringify(previews));
      const pos = event.payload;

      try {
        await invokeTauri<void>(TAURI_COMMANDS.openPopoverWindow, {
          query: `window=tray-notification-popover&data=${data}`,
          x: pos.x,
          y: pos.y - 300,
          width: 360,
          height: Math.min(previews.length * 64 + 40, 320),
        });
      } catch (err) {
        logger.warn("Action: chat_tray_hover_popover_open_failed", { error: String(err) });
      }
    });
    unlisteners.push(unlistenHover);

    const unlistenJump = await listen<{ channelId: string }>("jump-to-channel", async (event) => {
      try {
        await chat.session.currentChannel.selectChannel(event.payload.channelId);
      } catch (err) {
        logger.warn("Action: chat_tray_hover_jump_channel_failed", { error: String(err) });
      }
    });
    unlisteners.push(unlistenJump);
  });

  return () => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  };
}
