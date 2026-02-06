/**
 * @fileoverview pluginTypes.ts
 * @description plugins｜领域类型：pluginTypes。
 */

export type PluginSource = "server" | "repo";

/**
 * 插件对外暴露的 domain 端口描述（用于 UI 展示与消息路由）。
 */
export type PluginDomainPort = {
  id: string;
  label: string;
  version: string;
  colorVar:
    | "--cp-domain-core"
    | "--cp-domain-ext-a"
    | "--cp-domain-ext-b"
    | "--cp-domain-ext-c"
    | "--cp-domain-unknown";
};

/**
 * 插件权限声明条目（用于权限弹窗与风险提示）。
 */
export type PluginPermission = {
  key: string;
  label: string;
  risk: "low" | "medium" | "high";
};

/**
 * 插件目录条目（用于插件中心列表展示）。
 */
export type PluginCatalogEntry = {
  pluginId: string;
  name: string;
  tagline: string;
  description: string;
  homepage?: string;
  source: PluginSource;
  downloadUrl?: string;
  sha256: string;
  required: boolean;
  versions: string[];
  providesDomains: PluginDomainPort[];
  permissions: PluginPermission[];
};

/**
 * 插件运行时入口信息（由 Rust 侧提供，供前端动态 import）。
 */
export type PluginRuntimeEntry = {
  serverId: string;
  pluginId: string;
  version: string;
  entry: string;
  permissions: string[];
  providesDomains: Array<{ domain: string; domain_version: string }>;
  minHostVersion: string;
};

/**
 * 已安装插件状态（用于 UI 展示与操作按钮状态）。
 */
export type InstalledPluginState = {
  pluginId: string;
  installedVersions: string[];
  currentVersion: string | null;
  enabled: boolean;
  status: "ok" | "failed";
  lastError: string;
};

/**
 * 插件操作进度阶段（用于进度条与安装流程文案）。
 */
export type PluginProgressStage =
  | "select_version"
  | "confirm"
  | "checking_updates"
  | "downloading"
  | "verifying_sha256"
  | "unpacking"
  | "switching"
  | "rolling_back"
  | "installed"
  | "enabling"
  | "enabled"
  | "failed";

/**
 * 插件操作进度对象（install/enable/switch 等）。
 */
export type PluginProgress = {
  pluginId: string;
  stage: PluginProgressStage;
  percent: number;
  message: string;
};
