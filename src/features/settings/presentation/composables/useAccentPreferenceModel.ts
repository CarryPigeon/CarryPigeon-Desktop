/**
 * @fileoverview useAccentPreferenceModel.ts
 * @description
 * settings｜页面编排：强调色（accent）偏好读取、回填与持久化。
 *
 * 主题（`data-theme`）与强调色（`data-accent`）解耦：
 * - `data-theme` 控制背景 / 文字 / 卡片等表层色（surface tokens）。
 * - `data-accent` 控制品牌强调色（accent / accent-2 / domain / glow / td-brand）。
 *
 * 旧用户（仅设置过 `data-theme=patchbay`，未单独设置 accent）通过
 * `:root[data-theme="patchbay"]:not([data-accent="default"])` 兼容规则沿用 patchbay 强调色。
 */

import { onMounted, ref, watch, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { readSettings, updateAccent } from "@/features/settings/application/settingsService";
import { DEFAULT_APP_ACCENT, type AppAccent } from "@/features/settings/domain/types/SettingsTypes";

export type AccentPreferenceModel = {
  accent: Ref<AppAccent>;
  accentError: Ref<string>;
  pickAccent(accent: AppAccent): void;
};

export function useAccentPreferenceModel(): AccentPreferenceModel {
  const { t } = useI18n();
  const accent = ref<AppAccent>(DEFAULT_APP_ACCENT);
  const accentError = ref("");
  const hydrated = ref(false);
  const accentTouched = ref(false);
  let skipNextPersist = false;

  function rollbackAccentTo(previousAccent: AppAccent): void {
    skipNextPersist = true;
    accent.value = previousAccent;
  }

  async function persistAccent(nextAccent: AppAccent, previousAccent: AppAccent): Promise<void> {
    accentError.value = "";
    try {
      await updateAccent(nextAccent);
    } catch (error) {
      accentError.value = String(error) || t("settings_save_accent_failed");
      rollbackAccentTo(previousAccent);
    }
  }

  function applyHydratedAccent(nextAccent: AppAccent): void {
    if (accent.value === nextAccent) {
      return;
    }
    skipNextPersist = true;
    accent.value = nextAccent;
  }

  async function hydrateAccentOnMounted(): Promise<void> {
    try {
      const settings = await readSettings();
      if (!accentTouched.value) applyHydratedAccent(settings.accent);
    } catch {
      accent.value = DEFAULT_APP_ACCENT;
    } finally {
      hydrated.value = true;
    }
  }

  watch(accent, async (nextAccent, previousAccent) => {
    if (!hydrated.value) return;
    if (skipNextPersist) {
      skipNextPersist = false;
      return;
    }
    await persistAccent(nextAccent, previousAccent);
  });

  onMounted(() => {
    void hydrateAccentOnMounted();
  });

  function pickAccent(nextAccent: AppAccent): void {
    accentTouched.value = true;
    accent.value = nextAccent;
  }

  return {
    accent,
    accentError,
    pickAccent,
  };
}
