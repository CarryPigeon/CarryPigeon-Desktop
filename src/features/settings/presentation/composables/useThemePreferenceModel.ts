/**
 * @fileoverview useThemePreferenceModel.ts
 * @description
 * settings｜页面编排：主题偏好读取、回填与持久化。
 */

import { onMounted, ref, watch, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { readSettings, updateTheme } from "@/features/settings/application/settingsService";
import { DEFAULT_APP_THEME, type AppThemePreference } from "@/features/settings/domain/types/SettingsTypes";

export type ThemePreferenceModel = {
  theme: Ref<AppThemePreference>;
  themeError: Ref<string>;
  pickTheme(theme: AppThemePreference): void;
};

export function useThemePreferenceModel(): ThemePreferenceModel {
  const { t } = useI18n();
  const theme = ref<AppThemePreference>(DEFAULT_APP_THEME);
  const themeError = ref("");
  const hydrated = ref(false);
  const themeTouched = ref(false);
  let skipNextPersist = false;

  function rollbackThemeTo(previousTheme: AppThemePreference): void {
    skipNextPersist = true;
    theme.value = previousTheme;
  }

  async function persistTheme(nextTheme: AppThemePreference, previousTheme: AppThemePreference): Promise<void> {
    themeError.value = "";
    try {
      await updateTheme(nextTheme);
    } catch (error) {
      themeError.value = String(error) || t("settings_save_theme_failed");
      rollbackThemeTo(previousTheme);
    }
  }

  function applyHydratedTheme(nextTheme: AppThemePreference): void {
    if (theme.value === nextTheme) {
      return;
    }
    skipNextPersist = true;
    theme.value = nextTheme;
  }

  async function hydrateThemeOnMounted(): Promise<void> {
    try {
      const settings = await readSettings();
      if (!themeTouched.value) applyHydratedTheme(settings.theme);
    } catch {
      theme.value = DEFAULT_APP_THEME;
    } finally {
      hydrated.value = true;
    }
  }

  watch(theme, async (nextTheme, previousTheme) => {
    if (!hydrated.value) return;
    if (skipNextPersist) {
      skipNextPersist = false;
      return;
    }
    await persistTheme(nextTheme, previousTheme);
  });

  onMounted(() => {
    void hydrateThemeOnMounted();
  });

  function pickTheme(nextTheme: AppThemePreference): void {
    themeTouched.value = true;
    theme.value = nextTheme;
  }

  return {
    theme,
    themeError,
    pickTheme,
  };
}
