/**
 * @fileoverview 通知桥接器。
 * @description
 * 将 message-flow 的新消息事件与桌面通知决策器/发送器桥接。
 * 提供给 createChatEventRouter 的 onNewMessage 钩子工厂。
 */

import { getCurrentWindow } from "@tauri-apps/api/window";
import { decideNotification } from "@/features/chat/message-flow/domain/usecases/notificationDecider";
import { sendDesktopNotification } from "@/features/chat/message-flow/domain/usecases/notificationSender";
import { createLogger } from "@/shared/utils/logger";
import type { ChatMessage } from "@/features/chat/message-flow/api-types";

const logger = createLogger("chat_notification_bridge");

/**
 * 创建新消息通知处理器工厂。
 *
 * @param deps.getDesktopNotificationsEnabled - 读取全局桌面通知开关
 * @param deps.getCurrentChannelId - 获取当前活跃频道 ID
 * @param deps.getChannelNotificationPreference - 获取指定频道的通知偏好
 * @param deps.getChannelName - 获取指定频道的显示名称
 */
export function createNotificationOnNewMessageHandler(deps: {
  getDesktopNotificationsEnabled: () => Promise<boolean>;
  getCurrentChannelId: () => string;
  getCurrentUserId: () => string;
  getChannelNotificationPreference: (channelId: string) => Promise<"all" | "mentions_only" | "muted">;
  getChannelName: (channelId: string) => string;
}) {
  return async function onNewMessage(channelId: string, message: ChatMessage): Promise<void> {
    try {
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
