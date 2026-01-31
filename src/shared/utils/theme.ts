/**
 * @fileoverview Theme utilities (Patchbay / legacy).
 */

export type AppTheme = "patchbay" | "legacy";

const THEME_KEY = "carrypigeon:theme";

/**
 * getStoredTheme 方法说明。
 * @returns 返回值说明。
 */
export function getStoredTheme(): AppTheme | null {
  const raw = String(localStorage.getItem(THEME_KEY) ?? "").trim().toLowerCase();
  if (raw === "patchbay") return "patchbay";
  if (raw === "legacy") return "legacy";
  return null;
}

/**
 * setTheme 方法说明。
 * @param theme - 参数说明。
 * @returns 返回值说明。
 */
export function setTheme(theme: AppTheme): void {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.dataset.theme = theme === "patchbay" ? "patchbay" : "legacy";
  if (document.body) document.body.dataset.theme = theme === "patchbay" ? "patchbay" : "legacy";
}
