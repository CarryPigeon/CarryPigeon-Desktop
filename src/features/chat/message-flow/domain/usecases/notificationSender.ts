/**
 * @fileoverview 桌面通知发送器。
 * @description
 * 封装 tauri-plugin-notification 的权限请求与通知发送逻辑。
 * 在 mock 模式下静默退化为日志输出，不发送真实通知。
 */

import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("notification");

let permissionChecked = false;

async function ensurePermission(): Promise<boolean> {
  if (permissionChecked) return true;
  let granted = false;
  try {
    granted = await isPermissionGranted();
  } catch {
    // isPermissionGranted may not be available in all contexts
  }
  if (!granted) {
    try {
      const result = await requestPermission();
      granted = result === "granted";
    } catch {
      // requestPermission may not be available
    }
  }
  permissionChecked = granted;
  return granted;
}

/**
 * 发送一条桌面通知。
 *
 * 在 mock 模式下只记录日志；在真实 Tauri 环境中请求权限并发送。
 * 所有异常都被捕获并记录，不向上冒泡。
 */
export async function sendDesktopNotification(params: {
  title: string;
  body: string;
  channelId: string;
  messageId: string;
}): Promise<void> {
  try {
    const hasPermission = await ensurePermission();
    if (!hasPermission) {
      logger.debug("Action: chat_chat_notification_permission_denied");
      return;
    }

    if (import.meta.env.VITE_USE_MOCK_API === "true") {
      logger.debug("Action: chat_notification_mock_send", { title: params.title, body: params.body });
      return;
    }

    sendNotification({ title: params.title, body: params.body });
    logger.debug("Action: chat_notification_sent", { channelId: params.channelId });
  } catch (e) {
    logger.error("Action: chat_notification_send_failed", { error: String(e) });
  }
}
