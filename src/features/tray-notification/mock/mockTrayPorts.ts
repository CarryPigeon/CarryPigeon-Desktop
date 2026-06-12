/**
 * @fileoverview tray-notification Mock 端口实现。
 * @description 在 mock 模式下使用的内存实现，不发起真实 Tauri 调用。
 */

import { createLogger } from "@/shared/utils/logger";
import type { TrayNotificationPorts, TrayFlashingPort, TrayLocalePort, TrayPopoverPort, DesktopNotificationPort } from "../domain/ports";

const logger = createLogger("mockTrayPorts");

function createMockFlashingAdapter(): TrayFlashingPort {
  return {
    async setFlashing(hasUnread: boolean): Promise<void> {
      logger.debug("Action: chat_mock_flashing_set", { hasUnread });
    },
    async clearFlashing(): Promise<void> {
      logger.debug("Action: chat_mock_flashing_cleared");
    },
  };
}

function createMockLocaleAdapter(): TrayLocalePort {
  return {
    async setLocale(locale: string): Promise<void> {
      logger.debug("Action: chat_mock_locale_set", { locale });
    },
  };
}

function createMockPopoverAdapter(): TrayPopoverPort {
  return {
    async openPopover(position, previews): Promise<void> {
      logger.debug("Action: chat_mock_popover_opened", {
        x: position.x,
        y: position.y,
        previewCount: previews.length,
      });
    },
    async closePopover(): Promise<void> {
      logger.debug("Action: chat_mock_popover_closed");
    },
  };
}

function createMockNotificationAdapter(): DesktopNotificationPort {
  return {
    async send(params): Promise<void> {
      logger.debug("Action: chat_mock_notification_sent", {
        title: params.title,
        channelId: params.channelId,
      });
    },
  };
}

export function createMockTrayPorts(): TrayNotificationPorts {
  return {
    flashing: createMockFlashingAdapter(),
    locale: createMockLocaleAdapter(),
    popover: createMockPopoverAdapter(),
    desktopNotification: createMockNotificationAdapter(),
  };
}
