/**
 * @fileoverview 应用语言持久化辅助。
 * @description 管理 settings 页使用的语言 key 与合法值，避免语言常量散落。
 */

import { KEY_APP_LOCALE } from "./storageKeys";
import { readString, writeString } from "./localStore";

export type AppLocale = "zh_cn" | "en_us";

export const DEFAULT_APP_LOCALE: AppLocale = "zh_cn";

export function isAppLocale(raw: string): raw is AppLocale {
  return raw === "zh_cn" || raw === "en_us";
}

export function getStoredLocale(): AppLocale | null {
  const raw = readString(KEY_APP_LOCALE).trim().toLowerCase();
  return isAppLocale(raw) ? raw : null;
}

export function setStoredLocale(locale: AppLocale): void {
  writeString(KEY_APP_LOCALE, locale);
}
