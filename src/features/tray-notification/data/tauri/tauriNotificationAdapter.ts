/**
 * @fileoverview 桌面通知 Tauri 适配器。
 * @description 实现 DesktopNotificationPort，通过 @tauri-apps/plugin-notification 发送桌面通知。
 */

import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { createLogger } from "@/shared/utils/logger";
import type { DesktopNotificationPort } from "../../domain/ports";
import type { DesktopNotificationParams } from "../../domain/model";

const logger = createLogger("trayNotificationAdapter");

export function createTauriNotificationAdapter(): DesktopNotificationPort {
  return {
    async send(params: DesktopNotificationParams): Promise<void> {
      try {
        let permitted = await isPermissionGranted();
        if (!permitted) {
          const permission = await requestPermission();
          permitted = permission === "granted";
        }
        if (!permitted) return;

        sendNotification({
          title: params.title,
          body: params.body,
        });
      } catch (error) {
        logger.warn("Action: chat_desktop_notification_failed", { error: String(error) });
      }
    },
  };
}
