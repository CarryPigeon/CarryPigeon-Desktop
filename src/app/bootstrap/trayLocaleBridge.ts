/**
 * @fileoverview 托盘菜单 locale bridge。
 * @description
 * 应用启动时检查持久化的语言偏好，若非常量 `zh_cn` 则通知 Rust 侧更新托盘菜单。
 * 语言切换由设置页面的 `selectLanguage` 负责同步，本模块仅处理启动时的初始同步。
 */

import { getStoredLocale } from "@/shared/utils/locale";
import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";
import { isTauriRuntimeAvailable } from "@/shared/tauri/runtime";
import { IS_MOCK_ENABLED } from "@/shared/config/runtime";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("trayLocaleBridge");

/**
 * 启动时同步语言偏好到托盘菜单。
 */
export function syncTrayLocaleOnStartup(): void {
  if (!isTauriRuntimeAvailable() || IS_MOCK_ENABLED) return;

  const stored = getStoredLocale();
  if (stored === null || stored === "zh_cn") return;

  applyTrayLocale(stored);
}

async function applyTrayLocale(locale: string): Promise<void> {
  try {
    await invokeTauri<void>(TAURI_COMMANDS.setTrayLocale, { locale });
  } catch (error) {
    logger.warn("Action: chat_tray_locale_sync_failed", { error: String(error), locale });
  }
}
