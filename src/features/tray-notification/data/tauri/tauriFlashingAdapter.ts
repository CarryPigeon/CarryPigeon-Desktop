/**
 * @fileoverview 托盘闪烁 Tauri 适配器。
 * @description 实现 TrayFlashingPort，通过 invokeTauri 调用 Rust 命令。
 */

import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";
import { createLogger } from "@/shared/utils/logger";
import type { TrayFlashingPort } from "../../domain/ports";

const logger = createLogger("trayFlashingAdapter");

export function createTauriFlashingAdapter(): TrayFlashingPort {
  return {
    async setFlashing(hasUnread: boolean): Promise<void> {
      try {
        await invokeTauri<void>(TAURI_COMMANDS.setTrayUnreadFlashing, { hasUnread });
      } catch (error) {
        logger.warn("Action: chat_flashing_set_failed", { error: String(error), hasUnread });
      }
    },

    async clearFlashing(): Promise<void> {
      try {
        await invokeTauri<void>(TAURI_COMMANDS.setTrayUnreadFlashing, { hasUnread: false });
      } catch (error) {
        logger.warn("Action: chat_flashing_clear_failed", { error: String(error) });
      }
    },
  };
}
