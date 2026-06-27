/**
 * @fileoverview settings 应用层公共编排。
 * @description
 * 为 presentation 与 feature 公共 API 提供稳定、直觉的调用入口，
 * 隐藏 DI 与 domain use case 的组装细节。
 */

import { getSetAccentUseCase, getSetThemeUseCase, getSettingsUseCase } from "../di/settings.di";
import type { AppAccent, AppSettings, AppTheme } from "../domain/types/SettingsTypes";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { invokeTauri, safeInvokeTauri } from "@/shared/tauri/invokeClient";
import { isTauriRuntimeAvailable } from "@/shared/tauri/runtime";

export type GeneralPreferenceKey = "auto_login" | "auto_launch" | "close_to_tray" | "check_for_updates";

export type BusinessPreferenceKey = "email_notifications" | "desktop_notifications" | "global_dnd" | "notification_sound";
type BooleanPreferenceKey = GeneralPreferenceKey | BusinessPreferenceKey;

export type GeneralPreferencesSnapshot = {
  autoLogin: boolean;
  autoLaunch: boolean;
  closeToTray: boolean;
  checkForUpdates: boolean;
};

const GENERAL_PREFERENCE_KEYS: readonly GeneralPreferenceKey[] = [
  "auto_login",
  "auto_launch",
  "close_to_tray",
  "check_for_updates",
];

const BUSINESS_PREFERENCE_KEYS: readonly BusinessPreferenceKey[] = [
  "email_notifications",
  "desktop_notifications",
  "global_dnd",
  "notification_sound",
];

/**
 * 读取当前应用设置快照。
 */
export function readSettings(): Promise<AppSettings> {
  return getSettingsUseCase().execute();
}

/**
 * 更新当前应用主题。
 */
export async function updateTheme(theme: AppTheme): Promise<void> {
  await getSetThemeUseCase().execute(theme);
  // Also persist to backend config for import/export consistency
  try {
    await invokeTauri<void>(TAURI_COMMANDS.settingsUpdateConfigString, { key: "theme", value: theme });
  } catch {
    // Theme is local-cache primary; backend persistence is best-effort
  }
}

/**
 * 更新当前应用强调色（accent）。
 */
export async function updateAccent(accent: AppAccent): Promise<void> {
  await getSetAccentUseCase().execute(accent);
  // Also persist to backend config for import/export consistency
  try {
    await invokeTauri<void>(TAURI_COMMANDS.settingsUpdateConfigString, { key: "accent", value: accent });
  } catch {
    // Accent is local-cache primary; backend persistence is best-effort
  }
}

async function readConfigBool(key: BooleanPreferenceKey): Promise<boolean> {
  if (!isTauriRuntimeAvailable()) return false;
  const value = await safeInvokeTauri<boolean>(TAURI_COMMANDS.settingsGetConfigBool, { key });
  return value ?? false;
}

async function updateConfigBool(key: BooleanPreferenceKey, value: boolean): Promise<void> {
  if (!isTauriRuntimeAvailable()) return;
  await invokeTauri<void>(TAURI_COMMANDS.settingsUpdateConfigBool, { key, value });
}

export async function readGeneralPreferences(): Promise<GeneralPreferencesSnapshot> {
  if (!isTauriRuntimeAvailable()) {
    return { autoLogin: false, autoLaunch: false, closeToTray: false, checkForUpdates: false };
  }
  const [autoLogin, autoLaunch, closeToTray, checkForUpdates] = await Promise.all(
    GENERAL_PREFERENCE_KEYS.map((key) => readConfigBool(key)),
  );

  return {
    autoLogin,
    autoLaunch,
    closeToTray,
    checkForUpdates,
  };
}

export async function updateGeneralPreference(key: GeneralPreferenceKey, value: boolean): Promise<void> {
  await updateConfigBool(key, value);
}

export type BusinessPreferencesSnapshot = {
  emailNotifications: boolean;
  desktopNotifications: boolean;
  globalDnd: boolean;
  notificationSound: boolean;
};

export async function readBusinessPreferences(): Promise<BusinessPreferencesSnapshot> {
  if (!isTauriRuntimeAvailable()) {
    return { emailNotifications: true, desktopNotifications: true, globalDnd: false, notificationSound: true };
  }
  const [emailNotifications, desktopNotifications, globalDnd, notificationSound] = await Promise.all(
    BUSINESS_PREFERENCE_KEYS.map((key) => readConfigBool(key)),
  );

  return {
    emailNotifications,
    desktopNotifications,
    globalDnd,
    notificationSound,
  };
}

export async function updateBusinessPreference(key: BusinessPreferenceKey, value: boolean): Promise<void> {
  await updateConfigBool(key, value);
}

export async function exportSettingsEnvelope(): Promise<string> {
  return invokeTauri<string>(TAURI_COMMANDS.settingsExportSettings);
}

export async function importSettingsEnvelope(raw: string): Promise<void> {
  await invokeTauri<void>(TAURI_COMMANDS.settingsImportSettings, { raw });
}

export async function resetSettingsEnvelope(): Promise<void> {
  await invokeTauri<void>(TAURI_COMMANDS.settingsResetSettings);
}

export async function readServerPort(): Promise<number> {
  return invokeTauri<number>(TAURI_COMMANDS.settingsGetConfigU32, { key: "server_port" });
}

export async function updateServerPort(port: number): Promise<void> {
  await invokeTauri<void>(TAURI_COMMANDS.settingsUpdateConfigU32, { key: "server_port", value: port });
}
