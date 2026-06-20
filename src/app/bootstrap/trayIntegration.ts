/**
 * @fileoverview 托盘与桌面通知集成模块。
 * @description
 * 合并原本分散在多个 bridge 文件中的托盘功能（未读闪烁、悬停弹窗、语言同步、桌面通知），
 * 统一在此文件中提供。每个功能块独立导出，方便调用方按需注册。
 *
 * 原始文件：
 *   - trayUnreadBridge.ts  (托盘未读闪烁)
 *   - trayHoverBridge.ts   (托盘悬停弹窗)
 *   - trayLocaleBridge.ts  (托盘菜单语言同步)
 *   - notificationBridge.ts (桌面通知)
 */

import { watch, type WatchStopHandle } from "vue";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";
import { isTauriRuntimeAvailable } from "@/shared/tauri/runtime";
import { IS_MOCK_ENABLED } from "@/shared/config/runtime";
import { createLogger } from "@/shared/utils/logger";
import { getStoredLocale } from "@/shared/utils/locale";
import { decideNotification } from "@/features/chat/message-flow/domain/usecases/notificationDecider";
import { sendDesktopNotification } from "@/features/chat/message-flow/domain/usecases/notificationSender";
import type { UnreadMessagePreview } from "@/features/chat/public/api-types";
import type { ChatMessage } from "@/features/chat/message-flow/api-types";

const logger = createLogger("trayIntegration");

let chatPromise: Promise<unknown> | null = null;

async function getChatLazy() {
  if (!chatPromise) {
    chatPromise = import("@/features/chat/public/api").then((m) => m.getChatCapabilities());
  }
  return chatPromise;
}

// ============ 托盘未读闪烁 ============

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

// ============ 托盘悬停通知 ============

/**
 * 注册托盘悬停通知监听。
 *
 * 返回清理函数（可在组件卸载时调用取消监听）。
 */
export function registerTrayHoverBridge(): (() => void) | null {
  if (!isTauriRuntimeAvailable() || IS_MOCK_ENABLED) return null;

  const unlisteners: (() => void)[] = [];

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

// ============ 托盘菜单语言同步 ============

/**
 * 启动时同步语言偏好到托盘菜单。
 */
export function syncTrayLocaleOnStartup(): void {
  if (!isTauriRuntimeAvailable() || IS_MOCK_ENABLED) return;

  const stored = getStoredLocale();
  if (stored === null) return;

  applyTrayLocale(stored);
}

async function applyTrayLocale(locale: string): Promise<void> {
  try {
    await invokeTauri<void>(TAURI_COMMANDS.setTrayLocale, { locale });
  } catch (error) {
    logger.warn("Action: chat_tray_locale_sync_failed", { error: String(error), locale });
  }
}

// ============ 桌面通知桥接 ============

/**
 * 创建新消息通知处理器工厂。
 *
 * @param deps.getDesktopNotificationsEnabled - 读取全局桌面通知开关
 * @param deps.getCurrentChannelId - 获取当前活跃频道 ID
 * @param deps.getChannelNotificationPreference - 获取指定频道的通知偏好
 * @param deps.getChannelName - 获取指定频道的显示名称
 */
export function createNotificationOnNewMessageHandler(deps: {
  getGlobalDndEnabled: () => Promise<boolean>;
  getDesktopNotificationsEnabled: () => Promise<boolean>;
  getCurrentChannelId: () => string;
  getCurrentUserId: () => string;
  getChannelNotificationPreference: (channelId: string) => Promise<"all" | "mentions_only" | "muted">;
  getChannelName: (channelId: string) => string;
}) {
  return async function onNewMessage(channelId: string, message: ChatMessage): Promise<void> {
    try {
      const globalDnd = await deps.getGlobalDndEnabled();
      const desktopEnabled = await deps.getDesktopNotificationsEnabled();
      let focused = true;
      try {
        focused = await getCurrentWindow().isFocused();
      } catch {
        // not in Tauri context
      }
      const currentCid = deps.getCurrentChannelId();
      let preference: "all" | "mentions_only" | "muted" = "all";
      try {
        preference = await deps.getChannelNotificationPreference(channelId);
      } catch {
        // use default
      }

      const currentUserId = deps.getCurrentUserId();
      const isMentioned =
        message.mentions != null &&
        message.mentions.some(
          (m) => m.userId === currentUserId || m.type === "everyone" || m.type === "here",
        );

      const decision = decideNotification({
        globalDndEnabled: globalDnd,
        desktopNotificationsEnabled: desktopEnabled,
        isWindowFocused: focused,
        messageChannelId: channelId,
        currentChannelId: currentCid,
        notificationPreference: preference,
        isMentioned,
      });

      if (!decision.shouldNotify) {
        logger.debug("Action: chat_notification_skipped", { reason: decision.reason });
        return;
      }

      const channelName = deps.getChannelName(channelId) || channelId;
      const senderName = message.from?.name ?? "Unknown";
      const previewText = message.kind === "core_text" ? message.text : (message as any).preview ?? "";
      const title = `${senderName} · #${channelName}`;
      const body = previewText.length > 100 ? previewText.slice(0, 100) + "..." : previewText;

      await sendDesktopNotification({ title, body, channelId, messageId: message.id });
    } catch (e) {
      logger.error("Action: chat_notification_handle_failed", { error: String(e) });
    }
  };
}
