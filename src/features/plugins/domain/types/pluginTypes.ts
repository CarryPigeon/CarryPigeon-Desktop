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
 * 插件某个版本对应的安装来源元数据。
 */
export type PluginCatalogVersionEntry = {
  version: string;
  source: PluginSource;
  downloadUrl?: string;
  sha256: string;
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
  versionEntries: PluginCatalogVersionEntry[];
  providesDomains: PluginDomainPort[];
  permissions: PluginPermission[];
};

/**
 * 插件目录条目的只读输入视图（用于纯读取场景）。
 *
 * 说明：
 * - 允许接收深只读数组（`readonly T[]`）；
 * - 兼容 `PluginCatalogEntry`（可变）与 API 包装后的只读对象。
 */
export type PluginCatalogEntryLike = Omit<
  PluginCatalogEntry,
  "versions" | "versionEntries" | "providesDomains" | "permissions"
> & {
  versions: readonly string[];
  versionEntries: readonly PluginCatalogVersionEntry[];
  providesDomains: readonly PluginDomainPort[];
  permissions: readonly PluginPermission[];
};

/**
 * 比较两个版本号（降序，较新的版本排前）。
 *
 * @param a - 版本号 a。
 * @param b - 版本号 b。
 * @returns 排序比较值。
 */
export function comparePluginVersionDesc(a: string, b: string): number {
  const av = String(a ?? "").trim();
  const bv = String(b ?? "").trim();
  // `numeric: true` 可在 "1.10" 与 "1.2" 这类场景下得到更合理的顺序。
  const diff = bv.localeCompare(av, undefined, { numeric: true, sensitivity: "base" });
  if (diff !== 0) return diff;
  return bv.localeCompare(av);
}

/**
 * 归一化并排序版本来源条目（去重 + 降序）。
 *
 * 去重策略：
 * - 同一 version 下优先保留 `server` 来源（避免 server/repo 冲突时误走 URL 安装）。
 * - 其次保留下载元数据更完整（downloadUrl/sha256）的条目。
 *
 * @param entries - 原始版本来源条目。
 * @returns 归一化后的条目数组。
 */
export function normalizePluginCatalogVersionEntries(entries: readonly PluginCatalogVersionEntry[]): PluginCatalogVersionEntry[] {
  const byVersion = new Map<string, PluginCatalogVersionEntry>();
  for (const raw of entries) {
    const version = String(raw?.version ?? "").trim();
    if (!version) continue;
    const next: PluginCatalogVersionEntry = {
      version,
      source: raw?.source === "repo" ? "repo" : "server",
      downloadUrl: String(raw?.downloadUrl ?? "").trim() || undefined,
      sha256: String(raw?.sha256 ?? "").trim(),
    };
    const prev = byVersion.get(version);
    if (!prev) {
      byVersion.set(version, next);
      continue;
    }
    if (prev.source !== "server" && next.source === "server") {
      byVersion.set(version, next);
      continue;
    }
    const prevScore = Number(Boolean(prev.downloadUrl)) + Number(Boolean(prev.sha256));
    const nextScore = Number(Boolean(next.downloadUrl)) + Number(Boolean(next.sha256));
    if (nextScore > prevScore) byVersion.set(version, next);
  }
  return Array.from(byVersion.values()).sort((a, b) => comparePluginVersionDesc(a.version, b.version));
}

/**
 * 提取插件目录条目的版本来源列表。
 *
 * 兼容逻辑：
 * - 若 `versionEntries` 已提供，直接归一化后返回；
 * - 否则按 `versions + 顶层 source/downloadUrl/sha256` 回填，兼容旧数据结构。
 *
 * @param plugin - 目录条目。
 * @returns 版本来源条目数组（已去重排序）。
 */
export function getPluginCatalogVersionEntries(plugin: PluginCatalogEntryLike): PluginCatalogVersionEntry[] {
  const fromEntries = normalizePluginCatalogVersionEntries(plugin.versionEntries ?? []);
  if (fromEntries.length > 0) return fromEntries;

  const source: PluginSource = plugin.source === "repo" ? "repo" : "server";
  const downloadUrl = String(plugin.downloadUrl ?? "").trim() || undefined;
  const sha256 = String(plugin.sha256 ?? "").trim();
  const fallback: PluginCatalogVersionEntry[] = [];
  for (const rawVersion of plugin.versions ?? []) {
    const version = String(rawVersion ?? "").trim();
    if (!version) continue;
    fallback.push({ version, source, downloadUrl, sha256 });
  }
  return normalizePluginCatalogVersionEntries(fallback);
}

/**
 * 解析插件目录的“最新版本”条目。
 *
 * @param plugin - 目录条目。
 * @returns 最新版本来源信息；缺失时返回 `null`。
 */
export function resolveLatestPluginCatalogVersionEntry(plugin: PluginCatalogEntryLike): PluginCatalogVersionEntry | null {
  return getPluginCatalogVersionEntries(plugin)[0] ?? null;
}

/**
 * 解析插件目录的“目标版本”条目。
 *
 * @param plugin - 目录条目。
 * @param version - 目标版本（为空时回退到最新版本）。
 * @returns 对应版本来源信息；缺失时返回 `null`。
 */
export function resolvePluginCatalogVersionEntry(
  plugin: PluginCatalogEntryLike,
  version: string,
): PluginCatalogVersionEntry | null {
  const v = String(version ?? "").trim();
  const entries = getPluginCatalogVersionEntries(plugin);
  if (!v) return entries[0] ?? null;
  return entries.find((it) => it.version === v) ?? null;
}

/**
 * 解析插件目录中的“最新版本号”。
 *
 * @param plugin - 目录条目。
 * @returns 最新版本号；无可用版本时返回空字符串。
 */
export function resolveLatestPluginCatalogVersion(plugin: PluginCatalogEntryLike): string {
  return resolveLatestPluginCatalogVersionEntry(plugin)?.version ?? "";
}

/**
 * 插件运行时公开的 domain 条目。
 */
export type RuntimeProvidesDomain = {
  domain: string;
  domainVersion: string;
};

/**
 * 插件运行时入口信息（由 Rust 侧提供，经边界映射后供前端动态 import）。
 */
export type PluginRuntimeEntry = {
  serverId: string;
  pluginId: string;
  version: string;
  entry: string;
  permissions: string[];
  providesDomains: RuntimeProvidesDomain[];
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
 * 已安装状态的只读输入视图（用于纯读取场景）。
 */
export type InstalledPluginStateLike = Omit<InstalledPluginState, "installedVersions"> & {
  installedVersions: readonly string[];
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

/**
 * 插件安装/切换进度回调。
 *
 * @param progress - 进度对象（stage/percent/message）。
 * @returns 无返回值。
 */
export type PluginProgressHandler = (progress: PluginProgress) => void;
