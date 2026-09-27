/**
 * @fileoverview theme 插件入口。
 * @description
 * 本插件是**宿主主题体系的薄代理**，不持有主题状态：
 * - activate 时读取宿主主题偏好 key（`carrypigeon:theme`），按宿主规则解析并应用
 *   `data-theme`（`system` 时跟随系统配色，并监听系统配色变化实时同步）；
 * - 首次激活时把旧版插件私有偏好（`theme.preference`）一次性迁移到宿主 key；
 * - 注册工具栏动作（palette 图标，order 60）点击循环切换「亮 → 暗 → 跟随系统」并写回宿主 key；
 * - 强调色（`data-accent`）由宿主设置页独占，本插件**永不**读写；
 * - 偏好缺失/无法识别时保持当前 DOM 主题不变，避免用插件的默认值覆盖宿主主题；
 * - deactivate 时仅摘除工具栏入口与系统配色监听，不回滚主题（主题归宿主所有）。
 */

import { h, defineComponent } from "vue";
import { Icon } from "tdesign-vue-next";
import type { Component } from "vue";
import type { PluginContext, ToolbarAction } from "@/features/plugins/api-types";
import { themeManifest } from "./manifest";
import {
  HOST_THEME_STORAGE_KEY,
  LEGACY_THEME_STORAGE_KEY,
  nextThemePreference,
  parseThemePreference,
  resolveThemeName,
  toThemeAttributes,
  type AppThemeName,
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

/** 系统配色媒体查询；环境不支持时返回 `null`。 */
function systemDarkMedia(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia("(prefers-color-scheme: dark)");
}

/** 系统当前是否为暗色配色。 */
function isSystemDark(): boolean {
  return systemDarkMedia()?.matches === true;
}

/**
 * 将实际主题写入 `documentElement`（以及 body，若存在）的 `data-theme`。
 *
 * @param theme - 实际主题。
 */
function applyThemeName(theme: AppThemeName): void {
  const attrs = toThemeAttributes(theme);
  document.documentElement.dataset.theme = attrs["data-theme"];
  if (document.body) document.body.dataset.theme = attrs["data-theme"];
}

/** 读取 DOM 上当前生效的主题（用于没有任何存储偏好时推导切换起点）。 */
function readAppliedTheme(): AppThemeName {
  const fromRoot = document.documentElement.dataset.theme;
  if (fromRoot === "dark") return "dark";
  if (fromRoot === "light") return "light";
  return document.body?.dataset.theme === "dark" ? "dark" : "light";
}

/** 读取宿主主题偏好；缺失/非法/不可用时返回 `null`。 */
function readHostPreference(): ThemePreference | null {
  try {
    return parseThemePreference(localStorage.getItem(HOST_THEME_STORAGE_KEY));
  } catch (error) {
    logger.warn("theme_host_preference_read_failed", { error: String(error) });
    return null;
  }
}

/** 把偏好写回宿主 key（失败仅告警，不影响已应用的视觉）。 */
function writeHostPreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(HOST_THEME_STORAGE_KEY, preference);
  } catch (error) {
    logger.warn("theme_host_preference_write_failed", { error: String(error) });
  }
}

let cleanup: (() => void) | null = null;

export function activate(ctx: PluginContext): void {
  let current: ThemePreference | null = null;
  const media = systemDarkMedia();
  let detachSystemListener: () => void = () => {};

  /** 按当前偏好（含系统配色解析）应用到 DOM。 */
  function applyCurrent(): void {
    if (!current) return;
    applyThemeName(resolveThemeName(current, isSystemDark()));
  }

  /** 仅在偏好为 `system` 时监听系统配色变化，其它情况摘除监听。 */
  function syncSystemListener(): void {
    detachSystemListener();
    detachSystemListener = () => {};
    if (current !== "system" || !media) return;
    const onChange = (): void => {
      applyCurrent();
    };
    media.addEventListener("change", onChange);
    detachSystemListener = () => media.removeEventListener("change", onChange);
  }

  /** 切换/初始化偏好：必要时持久化到宿主 key，并同步系统配色监听。 */
  function setPreference(preference: ThemePreference, persist: boolean): void {
    current = preference;
    if (persist) writeHostPreference(preference);
    applyCurrent();
    syncSystemListener();
  }

  const hostPreference = readHostPreference();
  if (hostPreference) {
    setPreference(hostPreference, false);
  } else {
    // 宿主 key 缺失：尝试一次性迁移旧插件偏好；无法识别则完全不碰 DOM。
    void ctx.host.storage
      .get(LEGACY_THEME_STORAGE_KEY)
      .then((raw) => {
        // 仅当仍处于激活状态时迁移，避免 deactivate 后的迟到写入。
        if (!cleanup) return;
        const migrated = parseThemePreference(raw);
        if (!migrated) return;
        setPreference(migrated, true);
        // 旧键迁移完成后清空，避免后续版本重复迁移（写入 null 即视为“无偏好”）。
        void ctx.host.storage.set(LEGACY_THEME_STORAGE_KEY, null).catch((error: unknown) => {
          logger.warn("theme_legacy_preference_clear_failed", { error: String(error) });
        });
        logger.info("theme_preference_migrated", { theme: migrated });
      })
      .catch((error: unknown) => {
        logger.warn("theme_legacy_preference_read_failed", { error: String(error) });
      });
  }

  /** 点击调色板图标：亮 → 暗 → 跟随系统 → 亮，并写回宿主 key。 */
  function cycle(): void {
    const next = nextThemePreference(current ?? readAppliedTheme());
    setPreference(next, true);
    logger.info("theme_switched", { theme: next });
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
    detachSystemListener();
    detachSystemListener = () => {};
    cleanup = null;
  };
}

export function deactivate(): void {
  cleanup?.();
  cleanup = null;
}
