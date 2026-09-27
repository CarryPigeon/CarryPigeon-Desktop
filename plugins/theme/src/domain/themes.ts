/**
 * @fileoverview theme 插件｜领域纯函数：宿主主题偏好模型。
 * @description
 * 不接触 DOM、不依赖 Vue，仅描述宿主主题偏好（`system` / `light` / `dark`）的解析、
 * 循环切换与 DOM 属性映射，便于单测与跨层复用。
 *
 * 单一真源说明：
 * 宿主主题偏好的存储 key 与取值定义在 `src/shared/utils/storageKeys.ts`（`KEY_THEME`）
 * 与 `src/shared/utils/theme.ts`（解析规则）；插件不深引宿主内部模块，这里以常量镜像
 * 同一契约，取值必须与宿主保持一致。
 */

/** 宿主主题偏好持久化 key（镜像 `KEY_THEME`）。 */
export const HOST_THEME_STORAGE_KEY = "carrypigeon:theme";

/** 旧版插件私有偏好 key（插件 storage），仅用于一次性迁移。 */
export const LEGACY_THEME_STORAGE_KEY = "theme.preference";

/** 支持的主题偏好（循环切换顺序即列表顺序）。 */
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;

/** 主题偏好：`system` 表示跟随系统配色。 */
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** 解析后的实际主题（宿主 CSS 只认这两个取值）。 */
export type AppThemeName = "light" | "dark";

/**
 * 判断取值是否为合法主题偏好。
 *
 * @param value - 待判断的取值。
 * @returns 合法时返回 `true`。
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/**
 * 兼容映射：把旧版主题取值折算到宿主的偏好体系。
 *
 * 兼容迁移：`patchbay` 为品牌暗色 → `dark`；`legacy` 为经典浅色 → `light`。
 *
 * @param value - 旧版取值。
 * @returns 映射后的偏好；无法识别时返回 `null`。
 */
export function migrateLegacyThemeName(value: unknown): ThemePreference | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "light" || raw === "legacy") return "light";
  if (raw === "dark" || raw === "patchbay") return "dark";
  if (raw === "system") return "system";
  return null;
}

/**
 * 解析主题偏好（容错）。
 *
 * 支持两种形态：
 * - 宿主形态：纯字符串 `"system"` / `"light"` / `"dark"`；
 * - 旧插件形态：JSON 字符串或已解析对象 `{ theme: "light" | "dark" | "patchbay" }`。
 *
 * 无法识别、为空或类型不符时返回 `null`，调用方据此保持当前 DOM 主题不变
 * （插件不得用自己的默认值覆盖宿主主题）。
 *
 * @param raw - 原始存储值。
 * @returns 解析出的偏好；不可用时返回 `null`。
 */
export function parseThemePreference(raw: unknown): ThemePreference | null {
  let candidate: unknown = raw;
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (!trimmed) return null;
    if (isThemePreference(trimmed)) return trimmed;
    try {
      candidate = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (typeof candidate !== "object" || candidate === null) return null;
  return migrateLegacyThemeName((candidate as Record<string, unknown>).theme);
}

/**
 * 循环下一个偏好：light → dark → system → light。
 *
 * @param current - 当前偏好。
 * @returns 下一个偏好。
 */
export function nextThemePreference(current: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(current);
  // indexOf 结果为 -1 时兜底到第一个偏好，保证函数总返回合法值（不抛错）。
  const safeIndex = index < 0 ? 0 : index;
  return THEME_PREFERENCES[(safeIndex + 1) % THEME_PREFERENCES.length]!;
}

/**
 * 把偏好解析为实际应用的主题。
 *
 * @param preference - 主题偏好（`system` 按系统配色解析）。
 * @param prefersDark - 系统当前是否为暗色。
 * @returns 实际主题 `"light"` / `"dark"`。
 */
export function resolveThemeName(preference: ThemePreference, prefersDark: boolean): AppThemeName {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}

/**
 * 实际主题 → DOM data 属性映射。
 *
 * 说明：只产出 `data-theme`；强调色（`data-accent`）由宿主设置页独占，插件不得覆盖。
 *
 * @param theme - 实际主题。
 * @returns 待写入 `documentElement` / `body` 的属性。
 */
export function toThemeAttributes(theme: AppThemeName): { "data-theme": AppThemeName } {
  return { "data-theme": theme };
}
