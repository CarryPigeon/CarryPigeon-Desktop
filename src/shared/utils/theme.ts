/**
 * @fileoverview 主题持久化与 DOM 主题标记。
 *
 * 架构说明：
 * 该模块刻意保持框架无关（不引入 Vue），用于展示层持久化用户主题选择，并通过 DOM attribute
 * 将主题状态暴露给 CSS。
 *
 * 工作方式：
 * - 使用稳定 key 将主题写入 `localStorage`。
 * - 将主题同步到 `document.documentElement.dataset.theme`（以及存在时的 `document.body.dataset.theme`）。
 *
 * 关联说明：
 * - `src/App.vue` 的 CSS token 依赖 `:root[data-theme="patchbay"]` 切换调色板。
 * - 默认主题在 `src/main.ts` 启动阶段设置。
 */

export type AppTheme = "patchbay" | "legacy";

/**
 * 主题持久化使用的 `localStorage` key。
 */
const THEME_KEY = "carrypigeon:theme";

/**
 * 从 `localStorage` 读取已持久化的主题。
 *
 * @returns 当存储值合法时返回 `"patchbay"` / `"legacy"`；否则返回 `null`。
 */
export function getStoredTheme(): AppTheme | null {
  const raw = String(localStorage.getItem(THEME_KEY) ?? "").trim().toLowerCase();
  if (raw === "patchbay") return "patchbay";
  if (raw === "legacy") return "legacy";
  return null;
}

/**
 * 持久化主题选择，并将其应用到 DOM。
 *
 * 副作用：
 * - 写入 `localStorage`。
 * - 更新 `<html>`（始终）与 `<body>`（存在时）的 `data-theme`。
 *
 * @param theme - 要应用的目标主题。
 */
export function setTheme(theme: AppTheme): void {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.dataset.theme = theme === "patchbay" ? "patchbay" : "legacy";
  if (document.body) document.body.dataset.theme = theme === "patchbay" ? "patchbay" : "legacy";
}
