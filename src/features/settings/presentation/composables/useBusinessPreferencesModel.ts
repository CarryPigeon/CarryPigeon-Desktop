/**
 * @fileoverview useBusinessPreferencesModel.ts
 * @description settings｜页面编排：业务偏好（通知）读取、回填与持久化。
 */

import { onMounted, ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  readBusinessPreferences,
  updateBusinessPreference,
  type BusinessPreferenceKey,
} from "@/features/settings/application/settingsService";

export type BusinessPreferencesModel = {
  emailNotifications: Ref<boolean>;
  desktopNotifications: Ref<boolean>;
  globalDnd: Ref<boolean>;
  notificationSound: Ref<boolean>;
  businessPreferencesError: Ref<string>;
  refreshBusinessPreferences(): Promise<void>;
  toggleEmailNotifications(next: boolean): Promise<void>;
  toggleDesktopNotifications(next: boolean): Promise<void>;
  toggleGlobalDnd(next: boolean): Promise<void>;
  toggleNotificationSound(next: boolean): Promise<void>;
};

export function useBusinessPreferencesModel(): BusinessPreferencesModel {
  const { t } = useI18n();
  const emailNotifications = ref(false);
  const desktopNotifications = ref(false);
  const globalDnd = ref(false);
  const notificationSound = ref(false);
  const businessPreferencesError = ref("");

  function setError(error: unknown, fallbackMessage: string): void {
    businessPreferencesError.value = error instanceof Error ? error.message : String(error) || fallbackMessage;
  }

  async function hydrateBusinessPreferences(): Promise<void> {
    try {
      const snapshot = await readBusinessPreferences();
      emailNotifications.value = snapshot.emailNotifications;
      desktopNotifications.value = snapshot.desktopNotifications;
      globalDnd.value = snapshot.globalDnd;
      notificationSound.value = snapshot.notificationSound;
      businessPreferencesError.value = "";
    } catch (error) {
      setError(error, t("settings_load_business_preferences_failed"));
    }
  }

  async function persistBusinessPreference(
    key: BusinessPreferenceKey,
    next: boolean,
    target: Ref<boolean>,
  ): Promise<void> {
    const previous = target.value;
    target.value = next;
    businessPreferencesError.value = "";

    try {
      await updateBusinessPreference(key, next);
    } catch (error) {
      target.value = previous;
      setError(error, t("settings_save_business_preference_failed"));
    }
  }

  function toggleEmailNotifications(next: boolean): Promise<void> {
    return persistBusinessPreference("email_notifications", next, emailNotifications);
  }

  function toggleDesktopNotifications(next: boolean): Promise<void> {
    return persistBusinessPreference("desktop_notifications", next, desktopNotifications);
  }

  function toggleGlobalDnd(next: boolean): Promise<void> {
    return persistBusinessPreference("global_dnd", next, globalDnd);
  }

  function toggleNotificationSound(next: boolean): Promise<void> {
    return persistBusinessPreference("notification_sound", next, notificationSound);
  }

  function refreshBusinessPreferences(): Promise<void> {
    return hydrateBusinessPreferences();
  }

  onMounted(() => {
    void hydrateBusinessPreferences();
  });

  return {
    emailNotifications,
    desktopNotifications,
    globalDnd,
    notificationSound,
    businessPreferencesError,
    refreshBusinessPreferences,
    toggleEmailNotifications,
    toggleDesktopNotifications,
    toggleGlobalDnd,
    toggleNotificationSound,
  };
}
