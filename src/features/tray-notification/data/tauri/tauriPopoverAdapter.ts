/**
 * @fileoverview 托盘弹窗 Tauri 适配器。
 * @description 实现 TrayPopoverPort，通过 invokeTauri 调用弹窗窗口命令。
 */

import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";
import { createLogger } from "@/shared/utils/logger";
import type { TrayPopoverPort } from "../../domain/ports";
import type { ScreenPosition, UnreadPreview } from "../../domain/model";

const logger = createLogger("trayPopoverAdapter");

export function createTauriPopoverAdapter(): TrayPopoverPort {
  return {
    async openPopover(position: ScreenPosition, previews: UnreadPreview[]): Promise<void> {
      const data = encodeURIComponent(JSON.stringify(previews));
      try {
        await invokeTauri<void>(TAURI_COMMANDS.openPopoverWindow, {
          query: `window=tray-notification-popover&data=${data}`,
          x: position.x,
          y: position.y - 300,
          width: 360,
          height: Math.min(previews.length * 64 + 40, 320),
        });
      } catch (error) {
        logger.warn("Action: chat_popover_open_failed", { error: String(error) });
      }
    },

    async closePopover(): Promise<void> {
      try {
        await invokeTauri<void>(TAURI_COMMANDS.closeTrayNotificationPopover);
      } catch (error) {
        logger.warn("Action: chat_popover_close_failed", { error: String(error) });
      }
    },
  };
}
