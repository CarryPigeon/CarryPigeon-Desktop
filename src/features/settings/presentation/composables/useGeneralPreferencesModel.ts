/**
 * @fileoverview useGeneralPreferencesModel.ts
 * @description settings｜页面编排：一般偏好（语言、启动、通知）读取、回填与持久化。
 */

import { onMounted, ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { readSettings } from "@/features/settings/application/settingsService";
import {
  readGeneralPreferences,
  updateGeneralPreference,
  type GeneralPreferenceKey,
} from "@/features/settings/application/settingsService";
import { DEFAULT_APP_LOCALE, setStoredLocale, type AppLocale } from "@/shared/utils/locale";
import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";
import { isTauriRuntimeAvailable } from "@/shared/tauri/runtime";

export type GeneralPreferencesModel = {
  language: Ref<AppLocale>;
  preferencesError: Ref<string>;
  autoLogin: Ref<boolean>;
  autoLaunch: Ref<boolean>;
  closeToTray: Ref<boolean>;
  checkForUpdates: Ref<boolean>;
  selectLanguage(locale: AppLocale): void;
  refreshGeneralPreferences(): Promise<void>;
  toggleAutoLogin(next: boolean): Promise<void>;
  toggleAutoLaunch(next: boolean): Promise<void>;
  toggleCloseToTray(next: boolean): Promise<void>;
  toggleCheckForUpdates(next: boolean): Promise<void>;
};

export function useGeneralPreferencesModel(): GeneralPreferencesModel {
  const i18n = useI18n();
  const language = ref<AppLocale>(DEFAULT_APP_LOCALE);
  const preferencesError = ref("");
  const autoLogin = ref(false);
  const autoLaunch = ref(false);
  const closeToTray = ref(false);
  const checkForUpdates = ref(false);

  function setError(error: unknown, fallbackMessage: string): void {
    preferencesError.value = error instanceof Error ? error.message : String(error) || fallbackMessage;
  }

  async function hydrateGeneralPreferences(): Promise<void> {
    try {
      const settings = await readSettings();
      language.value = settings.locale ?? DEFAULT_APP_LOCALE;
      setStoredLocale(language.value);
      i18n.locale.value = language.value;
      const snapshot = await readGeneralPreferences();
      autoLogin.value = snapshot.autoLogin;
      autoLaunch.value = snapshot.autoLaunch;
      closeToTray.value = snapshot.closeToTray;
      checkForUpdates.value = snapshot.checkForUpdates;
      preferencesError.value = "";
    } catch (error) {
      setError(error, i18n.t("settings_load_general_preferences_failed"));
    }
  }

  async function persistBooleanPreference(key: GeneralPreferenceKey, next: boolean, target: Ref<boolean>): Promise<void> {
    const previous = target.value;
    target.value = next;
    preferencesError.value = "";

    try {
      await updateGeneralPreference(key, next);
    } catch (error) {
      target.value = previous;
      setError(error, i18n.t("settings_save_preference_failed"));
    }
  }

  function selectLanguage(next: AppLocale): void {
    const previous = language.value;
    language.value = next;
    preferencesError.value = "";

    try {
      setStoredLocale(next);
      i18n.locale.value = next;
      if (isTauriRuntimeAvailable()) {
        void invokeTauri<void>(TAURI_COMMANDS.setTrayLocale, { locale: next });
      }
    } catch (error) {
      language.value = previous;
      setError(error, i18n.t("settings_save_language_preference_failed"));
    }
  }

  function toggleAutoLogin(next: boolean): Promise<void> {
    return persistBooleanPreference("auto_login", next, autoLogin);
  }

  function toggleAutoLaunch(next: boolean): Promise<void> {
    return persistBooleanPreference("auto_launch", next, autoLaunch);
  }

  function toggleCloseToTray(next: boolean): Promise<void> {
    return persistBooleanPreference("close_to_tray", next, closeToTray);
  }

  function toggleCheckForUpdates(next: boolean): Promise<void> {
    return persistBooleanPreference("check_for_updates", next, checkForUpdates);
  }

  function refreshGeneralPreferences(): Promise<void> {
    return hydrateGeneralPreferences();
  }

  onMounted(() => {
    void hydrateGeneralPreferences();
  });

  return {
    language,
    preferencesError,
    autoLogin,
    autoLaunch,
    closeToTray,
    checkForUpdates,
    selectLanguage,
    refreshGeneralPreferences,
    toggleAutoLogin,
    toggleAutoLaunch,
    toggleCloseToTray,
    toggleCheckForUpdates,
  };
}
