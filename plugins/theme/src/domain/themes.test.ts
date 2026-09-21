// 主题领域纯函数单测：循环切换、解析容错、属性映射。
import { describe, expect, it } from "vitest";
import {
  ACCENTS,
  DEFAULT_THEME_PREFERENCE,
  THEMES,
  nextTheme,
  parseThemePreference,
  toThemeAttributes,
} from "./themes";

describe("theme domain", () => {
  describe("nextTheme", () => {
    it("cycles light→dark→patchbay→light", () => {
      expect(nextTheme("light")).toBe("dark");
      expect(nextTheme("dark")).toBe("patchbay");
      expect(nextTheme("patchbay")).toBe("light");
    });

    it("covers every theme in the cycle", () => {
      // 沿环走一整圈，必须不重复地回到起点。
      let current: (typeof THEMES)[number] = THEMES[0];
      const seen: string[] = [];
      for (let i = 0; i < THEMES.length; i += 1) {
        seen.push(current);
        current = nextTheme(current);
      }
      expect(seen).toEqual([...THEMES]);
      expect(current).toBe(THEMES[0]);
    });
  });

  describe("parseThemePreference", () => {
    it("parses valid JSON string", () => {
      expect(parseThemePreference('{"theme":"dark","accent":"violet"}')).toEqual({
        theme: "dark",
        accent: "violet",
      });
    });

    it("parses already-decoded object", () => {
      expect(parseThemePreference({ theme: "patchbay", accent: "cyan" })).toEqual({
        theme: "patchbay",
        accent: "cyan",
      });
    });

    it("falls back to defaults on malformed JSON", () => {
      expect(parseThemePreference("{not json")).toEqual(DEFAULT_THEME_PREFERENCE);
      expect(parseThemePreference("")).toEqual(DEFAULT_THEME_PREFERENCE);
    });

    it("falls back to defaults on wrong types", () => {
      expect(parseThemePreference(42)).toEqual(DEFAULT_THEME_PREFERENCE);
      expect(parseThemePreference(null)).toEqual(DEFAULT_THEME_PREFERENCE);
      expect(parseThemePreference(undefined)).toEqual(DEFAULT_THEME_PREFERENCE);
    });

    it("fills defaults on missing fields", () => {
      expect(parseThemePreference({})).toEqual(DEFAULT_THEME_PREFERENCE);
      expect(parseThemePreference({ theme: "dark" })).toEqual({ theme: "dark", accent: "default" });
      expect(parseThemePreference({ accent: "cyan" })).toEqual({ theme: "light", accent: "cyan" });
    });

    it("falls back per-field on invalid enum values", () => {
      expect(parseThemePreference({ theme: "neon", accent: "violet" })).toEqual({
        theme: "light",
        accent: "violet",
      });
      expect(parseThemePreference({ theme: "dark", accent: "rainbow" })).toEqual({
        theme: "dark",
        accent: "default",
      });
    });
  });

  describe("toThemeAttributes", () => {
    it("maps preference to data attributes", () => {
      expect(toThemeAttributes({ theme: "dark", accent: "violet" })).toEqual({
        "data-theme": "dark",
        "data-accent": "violet",
      });
    });

    it("maps default preference", () => {
      expect(toThemeAttributes(DEFAULT_THEME_PREFERENCE)).toEqual({
        "data-theme": "light",
        "data-accent": "default",
      });
    });

    it("always produces members of the declared enums", () => {
      for (const theme of THEMES) {
        for (const accent of ACCENTS) {
          const attrs = toThemeAttributes({ theme, accent });
          expect(THEMES).toContain(attrs["data-theme"]);
          expect(ACCENTS).toContain(attrs["data-accent"]);
        }
      }
    });
  });
});
