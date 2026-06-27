/**
 * @fileoverview useSettingsPageModel.ts
 * @description settings｜页面编排：聚合设置页需要的主题偏好子模型。
 */

import type { Ref } from "vue";
import type { AppAccent, AppTheme } from "@/features/settings/domain/types/SettingsTypes";
import { useAccentPreferenceModel } from "./useAccentPreferenceModel";
import { useThemePreferenceModel } from "./useThemePreferenceModel";
import { useGeneralPreferencesModel } from "./useGeneralPreferencesModel";
import { useBusinessPreferencesModel } from "./useBusinessPreferencesModel";
import type { AppLocale } from "@/shared/utils/locale";
export type UseSettingsPageModelDeps = Record<string, never>;

export type SettingsPageModel = {
  theme: Ref<AppTheme>;
  themeError: Ref<string>;
  pickTheme(v: AppTheme): void;
  accent: Ref<AppAccent>;
  accentError: Ref<string>;
  pickAccent(v: AppAccent): void;
  language: Ref<AppLocale>;
  preferencesError: Ref<string>;
  autoLogin: Ref<boolean>;
  autoLaunch: Ref<boolean>;
  closeToTray: Ref<boolean>;
  checkForUpdates: Ref<boolean>;
  emailNotifications: Ref<boolean>;
  desktopNotifications: Ref<boolean>;
  globalDnd: Ref<boolean>;
  notificationSound: Ref<boolean>;
  selectLanguage(locale: AppLocale): void;
  refreshGeneralPreferences(): Promise<void>;
  refreshBusinessPreferences(): Promise<void>;
  toggleAutoLogin(next: boolean): Promise<void>;
  toggleAutoLaunch(next: boolean): Promise<void>;
  toggleCloseToTray(next: boolean): Promise<void>;
  toggleCheckForUpdates(next: boolean): Promise<void>;
  toggleEmailNotifications(next: boolean): Promise<void>;
  toggleDesktopNotifications(next: boolean): Promise<void>;
  toggleGlobalDnd(next: boolean): Promise<void>;
  toggleNotificationSound(next: boolean): Promise<void>;
  businessPreferencesError: Ref<string>;
};

export function useSettingsPageModel(deps: UseSettingsPageModelDeps = {}): SettingsPageModel {
  void deps;
  const themeModel = useThemePreferenceModel();
  const accentModel = useAccentPreferenceModel();
  const generalPreferencesModel = useGeneralPreferencesModel();
  const businessPreferencesModel = useBusinessPreferencesModel();

  return {
    ...themeModel,
    ...accentModel,
    ...generalPreferencesModel,
    ...businessPreferencesModel,
  };
}
