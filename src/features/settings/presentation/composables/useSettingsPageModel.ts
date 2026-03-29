/**
 * @fileoverview useSettingsPageModel.ts
 * @description settings｜页面编排：聚合设置页需要的主题偏好子模型。
 */

import type { Ref } from "vue";
import type { AppTheme } from "@/features/settings/domain/types/SettingsTypes";
import { useThemePreferenceModel } from "./useThemePreferenceModel";
export type UseSettingsPageModelDeps = Record<string, never>;

export type SettingsPageModel = {
  theme: Ref<AppTheme>;
  themeError: Ref<string>;
  pickTheme(v: AppTheme): void;
};

export function useSettingsPageModel(deps: UseSettingsPageModelDeps = {}): SettingsPageModel {
  void deps;
  return useThemePreferenceModel();
}
