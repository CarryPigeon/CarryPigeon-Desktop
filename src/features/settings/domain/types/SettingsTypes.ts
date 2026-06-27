/**
 * @fileoverview settings 领域类型。
 * @description
 * 统一定义 settings feature 对外可见的稳定值对象与基础常量。
 */

import type { AppTheme } from "@/shared/utils/theme";
import type { AppAccent } from "@/shared/utils/theme";
import type { AppLocale } from "@/shared/utils/locale";
export type { AppTheme } from "@/shared/utils/theme";
export type { AppAccent } from "@/shared/utils/theme";
export type { AppLocale } from "@/shared/utils/locale";

/**
 * settings schema version。
 */
export const SETTINGS_SCHEMA_VERSION = 1 as const;

/**
 * settings schema 版本号。
 */
export type SettingsSchemaVersion = typeof SETTINGS_SCHEMA_VERSION;

/**
 * settings 字段所有权。
 */
export type SettingsOwnership = "local-cache" | "backend-authoritative" | "derived";

/**
 * settings 字段生效方式。
 */
export type SettingsApplyMode = "live" | "reload" | "restart" | "bootstrap-only" | "derived";

/**
 * settings 导入时的校验规则。
 */
export type SettingsImportValidationRule =
  | "schema-version-must-match"
  | "required-fields-must-exist"
  | "unknown-fields-rejected";

/**
 * settings 服务器目录条目（用于版本化导入/导出）。
 */
export type SettingsServerConfig = {
  serverSocket: string;
  serverPort: number;
  serverName: string;
  account: string;
  userName: string;
  userAvatar: string;
};

/**
 * 后端权威设置快照（版本 1）。
 */
export type SettingsBackendStateV1 = {
  autoLogin: boolean;
  autoLaunch: boolean;
  closeToTray: boolean;
  checkForUpdates: boolean;
  emailNotifications: boolean;
  desktopNotifications: boolean;
  serverList: readonly SettingsServerConfig[];
};

/**
 * 本地缓存设置快照（版本 1）。
 */
export type SettingsLocalCacheStateV1 = {
  theme: AppTheme;
  accent: AppAccent;
  locale: AppLocale;
};

/**
 * 版本化 settings 导入/导出信封（版本 1）。
 */
export type SettingsSchemaEnvelopeV1 = {
  schemaVersion: SettingsSchemaVersion;
  backend: SettingsBackendStateV1;
  localCache: SettingsLocalCacheStateV1;
};

/**
 * settings 字段定义。
 */
export type SettingsFieldDefinition = {
  key: string;
  owner: SettingsOwnership;
  applyMode: SettingsApplyMode;
  persisted: boolean;
  mandatory: boolean;
};

/**
 * settings 分类定义。
 */
export type SettingsTaxonomyGroup = {
  id: string;
  owner: SettingsOwnership;
  applyMode: SettingsApplyMode;
  fields: readonly SettingsFieldDefinition[];
};

/**
 * settings 归类税表。
 *
 * 说明：
 * - app preferences：当前设置页可直接展示/编辑的本地偏好；
 * - business feature settings：由 backend 持久化的业务态设置；
 * - local-cache bootstrap：仅用于启动/预览的本地缓存；
 * - backend authoritative：长期持久化的权威状态；
 * - derived values：只读派生值，不参与持久化。
 */
export const SETTINGS_TAXONOMY = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  groups: [
    {
      id: "app-preferences",
      owner: "local-cache",
      applyMode: "live",
      fields: [
        {
          key: "theme",
          owner: "local-cache",
          applyMode: "live",
          persisted: true,
          mandatory: true,
        },
        {
          key: "accent",
          owner: "local-cache",
          applyMode: "live",
          persisted: true,
          mandatory: true,
        },
      ],
    },
    {
      id: "business-feature-settings",
      owner: "backend-authoritative",
      applyMode: "live",
      fields: [
        {
          key: "emailNotifications",
          owner: "backend-authoritative",
          applyMode: "live",
          persisted: true,
          mandatory: true,
        },
        {
          key: "desktopNotifications",
          owner: "backend-authoritative",
          applyMode: "live",
          persisted: true,
          mandatory: true,
        },
        {
          key: "autoLogin",
          owner: "backend-authoritative",
          applyMode: "restart",
          persisted: true,
          mandatory: true,
        },
        {
          key: "autoLaunch",
          owner: "backend-authoritative",
          applyMode: "restart",
          persisted: true,
          mandatory: true,
        },
        {
          key: "closeToTray",
          owner: "backend-authoritative",
          applyMode: "live",
          persisted: true,
          mandatory: true,
        },
        {
          key: "checkForUpdates",
          owner: "backend-authoritative",
          applyMode: "live",
          persisted: true,
          mandatory: true,
        },
      ],
    },
    {
      id: "local-cache-bootstrap",
      owner: "local-cache",
      applyMode: "bootstrap-only",
      fields: [],
    },
    {
      id: "backend-authoritative",
      owner: "backend-authoritative",
      applyMode: "restart",
      fields: [
        {
          key: "serverList",
          owner: "backend-authoritative",
          applyMode: "restart",
          persisted: true,
          mandatory: true,
        },
      ],
    },
    {
      id: "derived-values",
      owner: "derived",
      applyMode: "derived",
      fields: [],
    },
  ],
} as const;

/**
 * settings 默认主题。
 */
export const DEFAULT_APP_THEME: AppTheme = "patchbay";

/**
 * settings 默认强调色。
 */
export const DEFAULT_APP_ACCENT: AppAccent = "patchbay";

/**
 * 应用设置快照。
 */
export type AppSettings = {
  theme: AppTheme;
  accent: AppAccent;
  locale: AppLocale;
};
