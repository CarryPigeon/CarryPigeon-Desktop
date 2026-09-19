/**
 * @fileoverview 主题持久化与 DOM 主题标记。
 *
 * 架构说明：
 * 该模块刻意保持框架无关（不引入 Vue），用于展示层持久化用户主题选择，并通过 DOM attribute
 * 将主题状态暴露给 CSS。
 *
 * 工作方式：
 * - 使用稳定 key 将主题偏好写入 `localStorage`（偏好可为 `system` / `light` / `dark`）。
 * - 将解析后的实际主题同步到 `document.documentElement.dataset.theme`（以及存在时的
 *   `document.body.dataset.theme`）；`system` 偏好按系统 `prefers-color-scheme` 解析。
 *
 * 关联说明：
 * - `src/App.vue` 的 CSS token 依赖 `:root[data-theme="..."]` 切换调色板。
 * - 默认主题在 `src/main.ts` 启动阶段设置。
 */

export type AppTheme = "light" | "dark";
export type AppThemePreference = "system" | "light" | "dark";
export type AppAccent = "default" | "patchbay";

import { readString, writeString } from "./localStore";
import { KEY_THEME, KEY_ACCENT } from "./storageKeys";

/**
 * 读取系统当前配色偏好（`prefers-color-scheme`）。
 *
 * @returns 系统为暗色时返回 `"dark"`；否则（含媒体查询不可用时）返回 `"light"`。
 */
export function getSystemTheme(): AppTheme {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

/**
 * 将主题偏好解析为实际应用的主题。
 *
 * @param preference - 主题偏好（`system` 按系统配色解析）。
 * @returns 实际主题 `"light"` / `"dark"`。
 */
export function resolveThemePreference(preference: AppThemePreference): AppTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

/**
 * 从 `localStorage` 读取已持久化的主题偏好。
 *
 * 兼容迁移：旧版本主题值按调色板归入新体系
 * （`patchbay` 为品牌暗色 → `dark`；`legacy` 为经典浅色 → `light`）。
 *
 * @returns 当存储值合法时返回 `"system"` / `"light"` / `"dark"`；否则返回 `null`。
 */
export function getStoredThemePreference(): AppThemePreference | null {
  const raw = readString(KEY_THEME).trim().toLowerCase();
  if (raw === "system") return "system";
  if (raw === "light") return "light";
  if (raw === "dark") return "dark";
  if (raw === "patchbay") return "dark";
  if (raw === "legacy") return "light";
  return null;
}

/**
 * 从 `localStorage` 读取已持久化的主题，并解析为实际主题
 * （`system` 偏好会按当前系统配色解析为 `light` / `dark`）。
 *
 * @returns 当存储值合法时返回 `"light"` / `"dark"`；否则返回 `null`。
 */
export function getStoredTheme(): AppTheme | null {
  const preference = getStoredThemePreference();
  return preference === null ? null : resolveThemePreference(preference);
}

/**
 * 从 `localStorage` 读取已持久化的强调色（accent）。
 *
 * @returns 当存储值合法时返回 `"default"` / `"patchbay"`；否则返回 `null`。
 */
export function getStoredAccent(): AppAccent | null {
  const raw = readString(KEY_ACCENT).trim().toLowerCase();
  if (raw === "default") return "default";
  if (raw === "patchbay") return "patchbay";
  return null;
}

/**
 * 仅将实际主题应用到 DOM（不写存储）。
 */
function applyThemeToDom(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
  if (document.body) document.body.dataset.theme = theme;
}

/**
 * 持久化主题偏好，并将解析后的实际主题应用到 DOM。
 *
 * 副作用：
 * - 写入 `localStorage`（保留 `system` 偏好原值，启动时重新解析）。
 * - 更新 `<html>`（始终）与 `<body>`（存在时）的 `data-theme`。
 *
 * @param preference - 要应用的主题偏好。
 */
export function setTheme(preference: AppThemePreference): void {
  writeString(KEY_THEME, preference);
  applyThemeToDom(resolveThemePreference(preference));
}

/**
 * 持久化强调色（accent）选择，并将其应用到 DOM。
 *
 * 副作用：
 * - 写入 `localStorage`。
 * - 更新 `<html>`（始终）与 `<body>`（存在时）的 `data-accent`。
 *
 * @param accent - 要应用的目标强调色。
 */
export function setAccent(accent: AppAccent): void {
  writeString(KEY_ACCENT, accent);
  document.documentElement.dataset.accent = accent;
  if (document.body) document.body.dataset.accent = accent;
}

/**
 * 注册系统配色变化监听：当用户偏好为 `system` 时实时跟随系统切换主题。
 *
 * @returns 取消监听的函数。
 */
export function followSystemTheme(): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = (): void => {
    if (getStoredThemePreference() === "system") {
      applyThemeToDom(getSystemTheme());
    }
  };
  media.addEventListener("change", handleChange);
  return () => media.removeEventListener("change", handleChange);
}
