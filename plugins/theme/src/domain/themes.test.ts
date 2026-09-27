// 主题领域纯函数单测：偏好解析、旧值迁移、循环切换、系统配色解析与 DOM 属性映射。
import { describe, expect, it } from "vitest";
import {
  THEME_PREFERENCES,
  isThemePreference,
  migrateLegacyThemeName,
  nextThemePreference,
  parseThemePreference,
  resolveThemeName,
  toThemeAttributes,
} from "./themes";

describe("theme domain", () => {
  describe("isThemePreference", () => {
    it("接受宿主三态取值", () => {
      expect(isThemePreference("system")).toBe(true);
      expect(isThemePreference("light")).toBe(true);
      expect(isThemePreference("dark")).toBe(true);
    });

    it("拒绝旧值与非法值", () => {
      expect(isThemePreference("patchbay")).toBe(false);
      expect(isThemePreference("")).toBe(false);
      expect(isThemePreference(null)).toBe(false);
      expect(isThemePreference(1)).toBe(false);
    });
  });

  describe("migrateLegacyThemeName", () => {
    it("patchbay→dark，legacy→light", () => {
      expect(migrateLegacyThemeName("patchbay")).toBe("dark");
      expect(migrateLegacyThemeName("legacy")).toBe("light");
      expect(migrateLegacyThemeName("DARK")).toBe("dark");
    });

    it("无法识别时返回 null", () => {
      expect(migrateLegacyThemeName("neon")).toBeNull();
      expect(migrateLegacyThemeName(undefined)).toBeNull();
      expect(migrateLegacyThemeName(null)).toBeNull();
    });
  });

  describe("parseThemePreference", () => {
    it("解析宿主形态（纯字符串）", () => {
      expect(parseThemePreference("system")).toBe("system");
      expect(parseThemePreference("dark")).toBe("dark");
      expect(parseThemePreference(" light ")).toBe("light");
    });

    it("解析旧插件形态（JSON 字符串 / 已解析对象），并迁移旧主题值", () => {
      expect(parseThemePreference('{"theme":"dark","accent":"violet"}')).toBe("dark");
      expect(parseThemePreference('{"theme":"patchbay"}')).toBe("dark");
      expect(parseThemePreference({ theme: "light", accent: "cyan" })).toBe("light");
    });

    it("缺失/无法识别时返回 null（调用方不得覆盖宿主主题）", () => {
      expect(parseThemePreference(null)).toBeNull();
      expect(parseThemePreference(undefined)).toBeNull();
      expect(parseThemePreference("")).toBeNull();
      expect(parseThemePreference("   ")).toBeNull();
      expect(parseThemePreference("{not json")).toBeNull();
      expect(parseThemePreference(42)).toBeNull();
      expect(parseThemePreference({ theme: "neon" })).toBeNull();
      expect(parseThemePreference({ accent: "violet" })).toBeNull();
    });
  });

  describe("nextThemePreference", () => {
    it("按 light→dark→system→light 循环", () => {
      expect(nextThemePreference("light")).toBe("dark");
      expect(nextThemePreference("dark")).toBe("system");
      expect(nextThemePreference("system")).toBe("light");
    });

    it("沿环走一整圈必须不重复地回到起点", () => {
      let current: (typeof THEME_PREFERENCES)[number] = THEME_PREFERENCES[0];
      const seen: string[] = [];
      for (let i = 0; i < THEME_PREFERENCES.length; i += 1) {
        seen.push(current);
        current = nextThemePreference(current);
      }
      expect(seen).toEqual([...THEME_PREFERENCES]);
      expect(current).toBe(THEME_PREFERENCES[0]);
    });
  });

  describe("resolveThemeName", () => {
    it("system 按系统配色解析", () => {
      expect(resolveThemeName("system", true)).toBe("dark");
      expect(resolveThemeName("system", false)).toBe("light");
    });

    it("显式偏好不受系统影响", () => {
      expect(resolveThemeName("light", true)).toBe("light");
      expect(resolveThemeName("dark", false)).toBe("dark");
    });
  });

  describe("toThemeAttributes", () => {
    it("只产出 data-theme，不触碰 data-accent", () => {
      expect(toThemeAttributes("dark")).toEqual({ "data-theme": "dark" });
      expect(Object.keys(toThemeAttributes("light"))).toEqual(["data-theme"]);
    });
  });
});
