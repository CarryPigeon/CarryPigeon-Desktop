/**
 * @fileoverview settings｜设置搜索纯逻辑（可独立单测）。
 * @description
 * 把「内置设置项索引 + 插件注册的设置项」统一成可搜索条目，并提供查询匹配：
 * - 匹配字段：标题、说明、追加关键词、所属分区名/副标题、锚点 id、（插件项的）插件 id；
 * - 查询按空白分词，所有 token 都必须命中（AND）；
 * - 匹配为大小写不敏感的子串匹配（不做拼音/模糊匹配）。
 *
 * 说明：本模块不依赖 Vue/Tauri/浏览器 API，纯函数实现，便于单测与复用。
 */

import type { PluginSettingsContribution } from "@/features/plugins/api-types";
import {
  SETTINGS_PLUGINS_SECTION_ID,
  type SettingsCatalogEntry,
  type SettingsSectionId,
  type SettingsSectionDefinition,
} from "./settingsCatalog";

/** 统一后的可搜索条目。 */
export type SettingsSearchEntry = {
  /** 锚点值（写入模板 `data-settings-item`）。 */
  anchor: string;
  /** 所属分区 id。 */
  sectionId: SettingsSectionId;
  /** 标题（已本地化）。 */
  title: string;
  /** 说明（已本地化；无说明时为空字符串）。 */
  description: string;
  /** 追加关键词（未本地化，原文）。 */
  keywords: readonly string[];
  /** 分区名（已本地化）。 */
  sectionLabel: string;
  /** 分区副标题（已本地化）。 */
  sectionSubtitle: string;
  /** 来源标签：插件项为插件 id；内置项为空字符串。 */
  sourceLabel: string;
  /** 同分区内排序值（越小越靠前）。 */
  order: number;
};

/** 构建可搜索条目的入参。 */
export type BuildSettingsSearchEntriesInput = {
  /** 内置设置项索引。 */
  catalog: readonly SettingsCatalogEntry[];
  /** 插件注册的设置项（宿主投影）。 */
  pluginItems: readonly PluginSettingsContribution[];
  /** 分区定义（顺序即结果顺序）。 */
  sections: readonly SettingsSectionDefinition[];
  /** 文案翻译函数（宿主 i18n）。 */
  translate(key: string): string;
  /** 插件设置分区锚点前缀函数返回值（用于插件项锚点）；缺省使用 `plugin:<pluginId>:<itemId>`。 */
  pluginItemAnchor?(item: PluginSettingsContribution): string;
};

/** 无匹配结果时返回的常量空数组（避免每次调用产生新引用）。 */
const EMPTY: readonly SettingsSearchEntry[] = [];

/**
 * 归一化查询串（trim + 小写 + 折叠空白）。
 *
 * @param raw - 原始输入。
 * @returns 归一化后的查询串；空查询返回空字符串。
 */
export function normalizeSettingsSearchQuery(raw: string): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * 组装条目的匹配用文本（小写，字段以换行分隔）。
 *
 * @param entry - 可搜索条目。
 * @returns 小写匹配文本。
 */
export function settingsSearchHaystack(entry: SettingsSearchEntry): string {
  return [
    entry.title,
    entry.description,
    entry.keywords.join(" "),
    entry.sectionLabel,
    entry.sectionSubtitle,
    entry.anchor,
    entry.sourceLabel,
  ]
    .join("\n")
    .toLowerCase();
}

/**
 * 构建可搜索条目列表（内置 + 插件）。
 *
 * 排序：与分区顺序一致（`sections` 顺序）；分区内按 `order`（内置项为 catalog 顺序，
 * 插件项为注册表排序——order → pluginId → 注册序）。
 *
 * @param input - 构建入参。
 * @returns 可搜索条目列表。
 */
export function buildSettingsSearchEntries(input: BuildSettingsSearchEntriesInput): SettingsSearchEntry[] {
  const sectionById = new Map<SettingsSectionId, { def: SettingsSectionDefinition; index: number }>();
  input.sections.forEach((def, index) => sectionById.set(def.id, { def, index }));

  const entries: Array<{ sectionIndex: number; entry: SettingsSearchEntry }> = [];

  for (const [index, item] of input.catalog.entries()) {
    const section = sectionById.get(item.sectionId);
    if (!section) continue;
    entries.push({
      sectionIndex: section.index,
      entry: {
        anchor: item.id,
        sectionId: item.sectionId,
        title: input.translate(item.titleKey),
        description: item.descriptionKey ? input.translate(item.descriptionKey) : "",
        keywords: item.keywords,
        sectionLabel: input.translate(section.def.labelKey),
        sectionSubtitle: input.translate(section.def.subtitleKey),
        sourceLabel: "",
        order: index,
      },
    });
  }

  const pluginSection = sectionById.get(SETTINGS_PLUGINS_SECTION_ID);
  if (pluginSection) {
    input.pluginItems.forEach((item, index) => {
      entries.push({
        sectionIndex: pluginSection.index,
        entry: {
          anchor: input.pluginItemAnchor
            ? input.pluginItemAnchor(item)
            : `plugin:${item.pluginId}:${item.id}`,
          sectionId: SETTINGS_PLUGINS_SECTION_ID,
          title: item.title,
          description: item.description ?? "",
          keywords: item.keywords,
          sectionLabel: input.translate(pluginSection.def.labelKey),
          sectionSubtitle: input.translate(pluginSection.def.subtitleKey),
          sourceLabel: item.pluginId,
          order: index,
        },
      });
    });
  }

  return entries
    .sort((a, b) => (a.sectionIndex === b.sectionIndex ? a.entry.order - b.entry.order : a.sectionIndex - b.sectionIndex))
    .map((item) => item.entry);
}

/**
 * 按查询串过滤条目。
 *
 * @param entries - 可搜索条目。
 * @param rawQuery - 原始查询串。
 * @returns 命中条目（保持传入顺序）；空查询返回空列表。
 */
export function filterSettingsSearchEntries(
  entries: readonly SettingsSearchEntry[],
  rawQuery: string,
): readonly SettingsSearchEntry[] {
  const tokens = normalizeSettingsSearchQuery(rawQuery).split(" ").filter(Boolean);
  if (tokens.length === 0) return EMPTY;
  return entries.filter((entry) => {
    const haystack = settingsSearchHaystack(entry);
    return tokens.every((token) => haystack.includes(token));
  });
}
