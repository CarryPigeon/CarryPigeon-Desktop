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
 * - `src/App.vue` 的 CSS token 依赖 `:root[data-theme="..."]` 切换调色板。
 * - 默认主题在 `src/main.ts` 启动阶段设置。
 */

export type AppTheme = "patchbay" | "legacy" | "light";
export type AppAccent = "default" | "patchbay";

import { readString, writeString } from "./localStore";
import { KEY_THEME, KEY_ACCENT } from "./storageKeys";

/**
 * 从 `localStorage` 读取已持久化的主题。
 *
 * @returns 当存储值合法时返回 `"patchbay"` / `"legacy"` / `"light"`；否则返回 `null`。
 */
export function getStoredTheme(): AppTheme | null {
  const raw = readString(KEY_THEME).trim().toLowerCase();
  if (raw === "patchbay") return "patchbay";
  if (raw === "legacy") return "legacy";
  if (raw === "light") return "light";
  return null;
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
 * 持久化主题选择，并将其应用到 DOM。
 *
 * 副作用：
 * - 写入 `localStorage`。
 * - 更新 `<html>`（始终）与 `<body>`（存在时）的 `data-theme`。
 *
 * @param theme - 要应用的目标主题。
 */
export function setTheme(theme: AppTheme): void {
  writeString(KEY_THEME, theme);
  document.documentElement.dataset.theme = theme;
  if (document.body) document.body.dataset.theme = theme;
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
