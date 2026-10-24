/**
 * @fileoverview settings｜设置索引（设置页分区与内置设置项的单一真源）。
 * @description
 * 设置页的左侧导航、搜索结果与「锚点跳转」都基于本文件：
 * - `SETTINGS_SECTIONS`：分区顺序与文案 key（内置 + 插件设置分区）；
 * - `SETTINGS_CATALOG`：内置设置项索引（锚点 id → 分区 → 标题/说明文案 key → 追加关键词）；
 * - 模板侧通过 `data-settings-item` 写入同一锚点 id，`SettingsPage.search.test.ts`
 *   会断言二者一一对应（防止改模板忘改索引导致的「跳转到不存在的位置」）。
 *
 * 说明：内置设置项标题/说明复用宿主 i18n key（渲染时本地化）；`keywords` 仅用于搜索兜底
 * （同义词/英文别名），不参与展示。
 */

/** 设置页分区 id（顺序即导航与内容区顺序）。 */
export const SETTINGS_SECTION_IDS = ["general", "business", "data", "plugins", "about"] as const;

/** 设置页分区 id 类型。 */
export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

/** 插件设置分区 id。 */
export const SETTINGS_PLUGINS_SECTION_ID = "plugins" as const;

/** 设置页分区定义（label 为导航与搜索结果中的分区名）。 */
export type SettingsSectionDefinition = {
  id: SettingsSectionId;
  labelKey: string;
  subtitleKey: string;
};

/** 设置页分区定义表。 */
export const SETTINGS_SECTIONS: readonly SettingsSectionDefinition[] = [
  { id: "general", labelKey: "general", subtitleKey: "settings_nav_general_sub" },
  { id: "business", labelKey: "settings_business", subtitleKey: "settings_nav_business_sub" },
  { id: "data", labelKey: "settings_data", subtitleKey: "settings_nav_data_sub" },
  { id: "plugins", labelKey: "settings_plugins_section", subtitleKey: "settings_nav_plugins_sub" },
  { id: "about", labelKey: "menu_about", subtitleKey: "about_version" },
];

/** 内置设置项索引条目。 */
export type SettingsCatalogEntry = {
  /** 锚点 id（同时写入模板的 `data-settings-item`）。 */
  id: string;
  /** 所属分区（插件设置分区不参与内置索引）。 */
  sectionId: Exclude<SettingsSectionId, "plugins">;
  /** 标题文案 key。 */
  titleKey: string;
  /** 说明文案 key（可选）。 */
  descriptionKey?: string;
  /** 追加搜索关键词（中英同义词兜底）。 */
  keywords: readonly string[];
};

/**
 * 内置设置项索引（与 `SettingsPage.vue` 模板中的 `data-settings-item` 一一对应）。
 *
 * 有意排除：`settings_mock_api` / `settings_mock_mode`（仅 dev 构建渲染，生产环境无锚点）。
 */
export const SETTINGS_CATALOG: readonly SettingsCatalogEntry[] = [
  // 通用偏好
  {
    id: "general-theme",
    sectionId: "general",
    titleKey: "settings_theme",
    descriptionKey: "settings_general_preferences_sub",
    keywords: ["theme", "appearance", "dark", "light", "system", "主题", "外观", "暗色", "亮色", "跟随系统"],
  },
  {
    id: "general-accent",
    sectionId: "general",
    titleKey: "settings_accent",
    descriptionKey: "settings_accent_hint",
    keywords: ["accent", "color", "brand", "强调色", "配色", "品牌色"],
  },
  {
    id: "general-language",
    sectionId: "general",
    titleKey: "settings_language",
    descriptionKey: "settings_language_hint",
    keywords: ["language", "locale", "chinese", "english", "语言", "简体中文", "英文"],
  },
  {
    id: "general-auto-login",
    sectionId: "general",
    titleKey: "auto_login",
    descriptionKey: "settings_startup_hint",
    keywords: ["auto login", "session", "自动登录", "登录"],
  },
  {
    id: "general-auto-launch",
    sectionId: "general",
    titleKey: "settings_auto_launch",
    descriptionKey: "settings_startup_hint",
    keywords: ["auto launch", "startup", "boot", "开机启动", "自启动", "开机"],
  },
  {
    id: "general-close-to-tray",
    sectionId: "general",
    titleKey: "close_to_tray",
    keywords: ["tray", "minimize", "托盘", "最小化", "关闭窗口"],
  },
  {
    id: "general-check-for-updates",
    sectionId: "general",
    titleKey: "check_for_updates",
    keywords: ["update", "upgrade", "检查更新", "更新", "升级"],
  },
  {
    id: "general-diagnostics-mode",
    sectionId: "general",
    titleKey: "settings_diagnostics_mode",
    descriptionKey: "settings_diagnostics_mode_desc",
    keywords: ["diagnostics", "performance", "诊断", "诊断模式", "性能"],
  },
  {
    id: "general-diagnostics-panel",
    sectionId: "general",
    titleKey: "diagnostics_panel_title",
    descriptionKey: "settings_runtime_hint",
    keywords: ["diagnostics", "panel", "logs", "memory", "诊断面板", "日志", "内存"],
  },
  // 业务设置
  {
    id: "business-email-notifications",
    sectionId: "business",
    titleKey: "email_notifications",
    descriptionKey: "settings_business_settings_sub",
    keywords: ["email", "notification", "邮件通知", "邮件"],
  },
  {
    id: "business-desktop-notifications",
    sectionId: "business",
    titleKey: "desktop_notifications",
    descriptionKey: "settings_business_settings_sub",
    keywords: ["desktop", "notification", "桌面通知", "通知"],
  },
  {
    id: "business-global-dnd",
    sectionId: "business",
    titleKey: "global_dnd",
    descriptionKey: "global_dnd_desc",
    keywords: ["do not disturb", "dnd", "mute", "免打扰", "勿扰"],
  },
  {
    id: "business-notification-sound",
    sectionId: "business",
    titleKey: "notification_sound",
    descriptionKey: "settings_business_settings_sub",
    keywords: ["sound", "audio", "提示音", "声音"],
  },
  // 数据管理
  {
    id: "data-import-export",
    sectionId: "data",
    titleKey: "settings_import_export_reset",
    descriptionKey: "settings_import_export_hint",
    keywords: ["import", "export", "reset", "backup", "导入", "导出", "重置", "备份", "默认值"],
  },
  {
    id: "data-entrypoints",
    sectionId: "data",
    titleKey: "settings_entrypoints",
    descriptionKey: "settings_data_management_sub",
    keywords: ["entrypoint", "server manager", "plugin center", "file manager", "emoji", "入口", "服务器管理", "插件中心", "文件管理", "表情"],
  },
  // 关于
  {
    id: "about-version",
    sectionId: "about",
    titleKey: "about_version",
    keywords: ["version", "version number", "版本", "版本号"],
  },
  {
    id: "about-check-updates",
    sectionId: "about",
    titleKey: "check_for_updates",
    keywords: ["update", "release", "更新", "升级", "发行版"],
  },
  {
    id: "about-tech-stack",
    sectionId: "about",
    titleKey: "about_tech_stack",
    keywords: ["tech stack", "framework", "tauri", "vue", "技术栈", "框架"],
  },
  {
    id: "about-license",
    sectionId: "about",
    titleKey: "about_license",
    keywords: ["license", "open source", "许可", "许可证", "开源"],
  },
  {
    id: "about-credits",
    sectionId: "about",
    titleKey: "about_credits",
    keywords: ["credits", "acknowledgements", "thanks", "致谢", "鸣谢", "贡献者"],
  },
];

/** 锚点属性名（模板与搜索共用）。 */
export const SETTINGS_ITEM_ATTRIBUTE = "data-settings-item";

/**
 * 分区内容锚点 id。
 *
 * @param sectionId - 分区 id。
 * @returns DOM 元素 id。
 */
export function settingsSectionAnchorId(sectionId: SettingsSectionId): string {
  return `settings-section-${sectionId}`;
}

/**
 * 插件设置项锚点值。
 *
 * @param pluginId - 插件 id。
 * @param itemId - 设置项 id（插件内唯一）。
 * @returns 锚点值（写入 `data-settings-item`）。
 */
export function settingsPluginItemAnchor(pluginId: string, itemId: string): string {
  return `plugin:${String(pluginId ?? "").trim()}:${String(itemId ?? "").trim()}`;
}

/**
 * 按锚点值查找设置项元素。
 *
 * 说明：锚点值由宿主生成（内置项 id 为常量；插件项 id 经
 * `PLUGIN_SETTINGS_ITEM_ID_PATTERN` 校验，不含引号/反斜杠），因此可直接拼接属性选择器。
 *
 * @param anchor - 锚点值。
 * @returns 命中的元素；不存在时返回 `null`。
 */
export function findSettingsAnchor(anchor: string): HTMLElement | null {
  const value = String(anchor ?? "").trim();
  if (!value) return null;
  return document.querySelector<HTMLElement>(`[${SETTINGS_ITEM_ATTRIBUTE}="${value}"]`);
}
