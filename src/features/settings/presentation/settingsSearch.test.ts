/**
 * @fileoverview settings｜设置搜索纯逻辑单测。
 * @description 覆盖：查询归一化、分词 AND、命中字段（标题/说明/关键词/分区名/插件 id）、
 * 结果顺序（分区顺序 → order）、插件项锚点与来源标签、空查询。
 */

import { describe, expect, it } from "vitest";
import type { PluginSettingsContribution } from "@/features/plugins/api-types";
import type { Component } from "vue";
import {
  SETTINGS_CATALOG,
  SETTINGS_SECTIONS,
  type SettingsCatalogEntry,
} from "./settingsCatalog";
import {
  buildSettingsSearchEntries,
  filterSettingsSearchEntries,
  normalizeSettingsSearchQuery,
  settingsSearchHaystack,
} from "./settingsSearch";

/** 简易文案表（key → 文案），缺省回退 key 本身。 */
const TRANSLATIONS: Record<string, string> = {
  general: "通用",
  settings_nav_general_sub: "主题 · 运行时",
  settings_business: "业务",
  settings_nav_business_sub: "功能设置",
  settings_data: "数据",
  settings_nav_data_sub: "导入 · 导出 · 重置",
  settings_plugins_section: "插件设置",
  settings_nav_plugins_sub: "由插件提供",
  menu_about: "关于",
  about_version: "版本",
  settings_theme: "主题",
  settings_accent: "强调色",
  settings_import_export_reset: "导入 / 导出 / 重置",
};

function translate(key: string): string {
  return TRANSLATIONS[key] ?? key;
}

/** 按 id 从内置索引裁剪子集（避免依赖条目下标，增删分区/条目不会误取错项）。 */
function catalogEntriesOf(ids: readonly string[]): readonly SettingsCatalogEntry[] {
  return ids.map((id) => {
    const entry = SETTINGS_CATALOG.find((item) => item.id === id);
    if (!entry) throw new Error(`catalog entry not found: ${id}`);
    return entry;
  });
}

const CATALOG: readonly SettingsCatalogEntry[] = catalogEntriesOf([
  "general-theme",
  "general-language",
  "data-import-export",
]);

function pluginItem(overrides: Partial<PluginSettingsContribution> = {}): PluginSettingsContribution {
  return {
    id: "backend",
    title: "AI 摘要后端",
    description: "选择生成总结所走的通道",
    keywords: ["后端", "backend", "服务端"],
    order: 10,
    component: {} as Component,
    pluginId: "ai-summary",
    serverSocket: "srv",
    ...overrides,
  };
}

function entriesOf(pluginItems: readonly PluginSettingsContribution[] = []) {
  return buildSettingsSearchEntries({
    catalog: CATALOG,
    pluginItems,
    sections: SETTINGS_SECTIONS,
    translate,
  });
}

describe("normalizeSettingsSearchQuery", () => {
  it("trim + 小写 + 折叠空白", () => {
    expect(normalizeSettingsSearchQuery("  Theme   Dark  ")).toBe("theme dark");
    expect(normalizeSettingsSearchQuery("   ")).toBe("");
  });
});

describe("buildSettingsSearchEntries", () => {
  it("按分区顺序排列内置项与插件项，并带上分区名与来源标签", () => {
    const entries = entriesOf([pluginItem()]);
    expect(entries.map((entry) => entry.anchor)).toEqual([
      "general-theme",
      "general-language",
      "data-import-export",
      "plugin:ai-summary:backend",
    ]);
    expect(entries[0]?.sectionLabel).toBe("通用");
    expect(entries[0]?.sourceLabel).toBe("");
    const plugin = entries[entries.length - 1]!;
    expect(plugin.sectionLabel).toBe("插件设置");
    expect(plugin.sourceLabel).toBe("ai-summary");
    expect(plugin.title).toBe("AI 摘要后端");
  });

  it("命中文本包含标题/说明/关键词/分区名/锚点/来源", () => {
    const entries = entriesOf([pluginItem()]);
    const entry = entries[entries.length - 1]!;
    const haystack = settingsSearchHaystack(entry);
    expect(haystack).toContain("ai 摘要后端");
    expect(haystack).toContain("选择生成总结所走的通道");
    expect(haystack).toContain("backend");
    expect(haystack).toContain("插件设置");
    expect(haystack).toContain("ai-summary");
    expect(haystack).toContain("plugin:ai-summary:backend");
  });
});

describe("filterSettingsSearchEntries", () => {
  const entries = entriesOf([pluginItem()]);

  it("空查询不返回结果", () => {
    expect(filterSettingsSearchEntries(entries, "")).toEqual([]);
    expect(filterSettingsSearchEntries(entries, "   ")).toEqual([]);
  });

  it("按标题命中（大小写不敏感）", () => {
    expect(filterSettingsSearchEntries(entries, "THEME").map((entry) => entry.anchor)).toEqual([
      "general-theme",
    ]);
  });

  it("按说明与关键词命中（含中文同义词）", () => {
    // 关键词 "导入" 命中 data-import-export（说明/关键词兜底）。
    expect(filterSettingsSearchEntries(entries, "导入").map((entry) => entry.anchor)).toContain(
      "data-import-export",
    );
    // "开机启动" 是 general-auto-launch 的关键词（该条目不在本测试的裁剪 catalog 中，故用插件项验证关键词）。
    expect(filterSettingsSearchEntries(entries, "服务端").map((entry) => entry.anchor)).toEqual([
      "plugin:ai-summary:backend",
    ]);
  });

  it("按分区名命中该分区全部条目", () => {
    expect(filterSettingsSearchEntries(entries, "插件设置").map((entry) => entry.anchor)).toEqual([
      "plugin:ai-summary:backend",
    ]);
    expect(filterSettingsSearchEntries(entries, "通用").map((entry) => entry.anchor)).toEqual([
      "general-theme",
      "general-language",
    ]);
  });

  it("多词以空格分隔取 AND", () => {
    expect(filterSettingsSearchEntries(entries, "AI 摘要").map((entry) => entry.anchor)).toEqual([
      "plugin:ai-summary:backend",
    ]);
    expect(filterSettingsSearchEntries(entries, "AI 主题")).toEqual([]);
  });

  it("无匹配返回空列表", () => {
    expect(filterSettingsSearchEntries(entries, "不存在的设置")).toEqual([]);
  });

  it("结果顺序跟随分区顺序与条目顺序", () => {
    // 插件项关键词含「主题」：与内置 general 分区条目同时命中时，内置项在前、插件项在后。
    const withThemeKeyword = entriesOf([pluginItem({ keywords: ["主题"] })]);
    const hit = filterSettingsSearchEntries(withThemeKeyword, "主题");
    expect(hit.map((entry) => entry.sectionId)).toEqual(["general", "general", "plugins"]);
    expect(hit[0]?.anchor).toBe("general-theme");
    expect(hit[hit.length - 1]?.anchor).toBe("plugin:ai-summary:backend");
  });
});
