/**
 * @fileoverview 托盘语言 Tauri 适配器。
 * @description 实现 TrayLocalePort，通过 invokeTauri 调用 Rust 命令。
 */

import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";
import { createLogger } from "@/shared/utils/logger";
import type { TrayLocalePort } from "../../domain/ports";

const logger = createLogger("trayLocaleAdapter");

export function createTauriLocaleAdapter(): TrayLocalePort {
  return {
    async setLocale(locale: string): Promise<void> {
      try {
        await invokeTauri<void>(TAURI_COMMANDS.setTrayLocale, { locale });
      } catch (error) {
        logger.warn("Action: chat_locale_set_failed", { error: String(error), locale });
      }
    },
  };
}
