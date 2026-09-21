/**
 * @fileoverview theme 插件入口。
 * @description
 * activate 时从宿主 storage 恢复主题偏好并应用到 documentElement/body；
 * 注册工具栏动作（palette 图标，order 60）点击循环切换主题并持久化；
 * deactivate 时卸载注册并恢复进入时的主题属性。
 */

import { h, defineComponent } from "vue";
import { Icon } from "tdesign-vue-next";
import type { Component } from "vue";
import type { PluginContext, ToolbarAction } from "@/features/plugins/api-types";
import { themeManifest } from "./manifest";
import {
  THEME_PREFERENCE_STORAGE_KEY,
  parseThemePreference,
  nextTheme,
  toThemeAttributes,
  type ThemePreference,
} from "./domain/themes";
import { createLogger } from "./shared/logger";
import "./styles/theme.css";

const logger = createLogger("plugin");

export const manifest = themeManifest;

// 本插件不提供消息 domain，无 renderer/composer。
export const renderers: Record<string, Component> = {};
export const composers: Record<string, Component> = {};

// 工具栏图标：复用宿主共享的 TDesign Icon 组件实例。
function makeIcon(name: string): Component {
  return defineComponent({
    name: `ThemeToolbarIcon-${name}`,
    render: () => h(Icon, { name }),
  });
}
const PaletteIcon = makeIcon("palette");

/** 将偏好写入 documentElement（以及 body，若存在）的 data-* 属性。 */
function applyPreference(preference: ThemePreference): void {
  const attrs = toThemeAttributes(preference);
  const { documentElement, body } = document;
  documentElement.dataset.theme = attrs["data-theme"];
  documentElement.dataset.accent = attrs["data-accent"];
  if (body) {
    body.dataset.theme = attrs["data-theme"];
    body.dataset.accent = attrs["data-accent"];
  }
}

function readAppliedAttributes(): Record<string, string> {
  const { documentElement, body } = document;
  return {
    theme: documentElement.dataset.theme ?? body?.dataset.theme ?? "",
    accent: documentElement.dataset.accent ?? body?.dataset.accent ?? "",
  };
}

/** 恢复进入时记录的 data-* 属性（空字符串表示当时未设置，则清除）。 */
function restoreAttributes(snapshot: Record<string, string>): void {
  const { documentElement, body } = document;
  for (const el of [documentElement, body].filter(Boolean) as HTMLElement[]) {
    for (const key of ["theme", "accent"] as const) {
      if (snapshot[key]) el.dataset[key] = snapshot[key];
      else delete el.dataset[key];
    }
  }
}

let cleanup: (() => void) | null = null;

export function activate(ctx: PluginContext): void {
  // 记录进入时的主题属性，deactivate 时恢复。
  const entryAttributes = readAppliedAttributes();

  let current: ThemePreference = { theme: "light", accent: "default" };
  let persist: (pref: ThemePreference) => void = () => {};

  // 从宿主 storage 恢复偏好；host API 全部可选，缺失时静默降级。
  void ctx.host.storage
    .get(THEME_PREFERENCE_STORAGE_KEY)
    .then((raw) => {
      const parsed = parseThemePreference(raw);
      // 仅当仍处于激活状态时应用，避免 deactivate 后的迟到的写入。
      if (!cleanup) return;
      current = parsed;
      applyPreference(parsed);
      logger.info("theme_preference_restored", { theme: parsed.theme, accent: parsed.accent });
    })
    .catch((error: unknown) => {
      logger.warn("theme_preference_restore_failed", { error: String(error) });
    });

  persist = (pref: ThemePreference) => {
    void ctx.host.storage
      .set(THEME_PREFERENCE_STORAGE_KEY, pref)
      .catch((error: unknown) => {
        logger.warn("theme_preference_persist_failed", { error: String(error) });
      });
  };

  function cycle(): void {
    current = { ...current, theme: nextTheme(current.theme) };
    applyPreference(current);
    persist(current);
    logger.info("theme_switched", { theme: current.theme, accent: current.accent });
  }

  const action: ToolbarAction = {
    id: "theme.cycle",
    label: "",
    icon: PaletteIcon,
    order: 60,
    onClick: () => cycle(),
  };

  const detach = ctx.host.registerToolbarAction?.(action) ?? (() => {});

  cleanup = () => {
    detach();
    restoreAttributes(entryAttributes);
    cleanup = null;
  };
}

export function deactivate(): void {
  cleanup?.();
  cleanup = null;
}
