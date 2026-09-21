/**
 * @fileoverview theme 插件｜领域纯函数：主题偏好模型。
 * @description
 * 不接触 DOM、不依赖 Vue，仅描述主题列表、循环切换与偏好解析/属性映射，
 * 便于单测与跨层复用。
 */

/** 支持的主题列表（循环切换顺序即列表顺序）。 */
export const THEMES = ["light", "dark", "patchbay"] as const;
export type ThemeName = (typeof THEMES)[number];

/** 支持的强调色列表。 */
export const ACCENTS = ["default", "violet", "cyan"] as const;
export type AccentName = (typeof ACCENTS)[number];

/** 主题偏好（持久化到宿主 storage 的形状）。 */
export type ThemePreference = {
  theme: ThemeName;
  accent: AccentName;
};

/** 默认偏好：解析失败或缺字段时的兜底值。 */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = {
  theme: "light",
  accent: "default",
};

/** 主题偏好持久化使用的 storage key（与宿主契约一致）。 */
export const THEME_PREFERENCE_STORAGE_KEY = "theme.preference";

function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

function isAccentName(value: unknown): value is AccentName {
  return typeof value === "string" && (ACCENTS as readonly string[]).includes(value);
}

/** 循环下一主题：light→dark→patchbay→light。 */
export function nextTheme(current: ThemeName): ThemeName {
  const index = THEMES.indexOf(current);
  // indexOf 结果为 -1 时兜底到第一个主题，保证函数总返回合法值（不抛错）。
  const safeIndex = index < 0 ? 0 : index;
  return THEMES[(safeIndex + 1) % THEMES.length]!;
}

/**
 * 解析主题偏好（容错）：
 * - 输入可以是 JSON 字符串或已解析对象；
 * - 非法 JSON / 缺字段 / 非法取值一律回退默认值（light/default）；
 * - 仅覆盖出现的字段，另一个字段保留默认。
 */
export function parseThemePreference(raw: unknown): ThemePreference {
  let candidate: unknown = raw;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return { ...DEFAULT_THEME_PREFERENCE };
    }
  }
  if (typeof candidate !== "object" || candidate === null) {
    return { ...DEFAULT_THEME_PREFERENCE };
  }
  const record = candidate as Record<string, unknown>;
  return {
    theme: isThemeName(record.theme) ? record.theme : DEFAULT_THEME_PREFERENCE.theme,
    accent: isAccentName(record.accent) ? record.accent : DEFAULT_THEME_PREFERENCE.accent,
  };
}

/** 偏好 → DOM data 属性映射（供 documentElement/body 设置）。 */
export function toThemeAttributes(preference: ThemePreference): {
  "data-theme": ThemeName;
  "data-accent": AccentName;
} {
  return {
    "data-theme": preference.theme,
    "data-accent": preference.accent,
  };
}
