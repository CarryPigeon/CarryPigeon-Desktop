/**
 * @fileoverview useThemePreferenceModel.ts
 * @description
 * settings｜页面编排：主题偏好读取、回填与持久化。
 */

import { onMounted, ref, watch, type Ref } from "vue";
import { readSettings, updateTheme } from "@/features/settings/application/settingsService";
import { DEFAULT_APP_THEME, type AppTheme } from "@/features/settings/domain/types/SettingsTypes";

export type ThemePreferenceModel = {
  theme: Ref<AppTheme>;
  themeError: Ref<string>;
  pickTheme(theme: AppTheme): void;
};

export function useThemePreferenceModel(): ThemePreferenceModel {
  const theme = ref<AppTheme>(DEFAULT_APP_THEME);
  const themeError = ref("");
  const hydrated = ref(false);
  const themeTouched = ref(false);
  let skipNextPersist = false;

  function rollbackThemeTo(previousTheme: AppTheme): void {
    skipNextPersist = true;
    theme.value = previousTheme;
  }

  async function persistTheme(nextTheme: AppTheme, previousTheme: AppTheme): Promise<void> {
    themeError.value = "";
    try {
      await updateTheme(nextTheme);
    } catch (error) {
      themeError.value = String(error) || "Save theme failed.";
      rollbackThemeTo(previousTheme);
    }
  }

  function applyHydratedTheme(nextTheme: AppTheme): void {
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

  function pickTheme(nextTheme: AppTheme): void {
    themeTouched.value = true;
    theme.value = nextTheme;
  }

  return {
    theme,
    themeError,
    pickTheme,
  };
}
