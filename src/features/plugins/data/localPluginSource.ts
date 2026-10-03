/**
 * @fileoverview 自带（本地）插件源
 * @description
 * 直接加载随宿主分发的 `plugins/<id>/dist` 构建产物（构建期经 `public/plugins/<id>/` 进入前端 dist），
 * 避免依赖外部插件托管：自带插件在 dev 与 release 下均“已安装且已启用”。
 * 通过 env `VITE_USE_LOCAL_PLUGINS`（逗号分隔插件 id 列表）覆盖或关闭；
 * 兼容旧开关 `VITE_USE_LOCAL_VOICE_CALL_PLUGIN=true`（仅启用 voice-call）。
 */

import type { PluginCatalogEntry, PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import type { InstalledPluginState } from "@/features/plugins/domain/types/pluginTypes";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import { normalizeServerKey } from "@/shared/serverKey";

/**
 * 本地插件源描述。
 */
type LocalPluginSourceDefinition = {
  pluginId: string;
  version: string;
  permissions: string[];
  providesDomains: Array<{ domain: string; domainVersion: string }>;
  /** 入口 API 版本：自带插件均已迁移到 Cordis v2 契约。 */
  entryApiVersion: number;
  /** IPC 白名单前缀（仅 voice-call 需要）。 */
  ipcPrefixes: string[];
};

/**
 * 自带插件源注册表（entry 统一指向 `/plugins/<id>/` 静态服务的构建产物）。
 *
 * 说明：entry 使用根相对路径 `/plugins/<id>/index.js`，由模块加载器直接 `import()`：
 * - dev 下 Vite 把 `public/` 挂在 dev 根；
 * - release 下构建期由 `plugins:build:all` + `plugins:dev:link` 把 `plugins/<id>/dist`
 *   拷入 `public/plugins/`，随前端 dist 一起分发（见 package.json `prebuild`）。
 * 服务端安装的插件仍走标准 `app://plugins/...` 分发，不依赖此源。
 */
const LOCAL_PLUGIN_SOURCES: Record<string, LocalPluginSourceDefinition> = {
  "voice-call": {
    pluginId: "voice-call",
    version: "0.1.0",
    permissions: ["invoke", "events", "ui", "storage"],
    providesDomains: [{ domain: "call_record", domainVersion: "1" }],
    entryApiVersion: 2,
    ipcPrefixes: ["voice_call:"],
  },
  theme: {
    pluginId: "theme",
    version: "0.1.0",
    permissions: ["ui", "storage"],
    providesDomains: [],
    entryApiVersion: 2,
    ipcPrefixes: [],
  },
  markdown: {
    pluginId: "markdown",
    version: "0.1.0",
    permissions: ["ui", "storage"],
    providesDomains: [{ domain: "markdown", domainVersion: "1" }],
    entryApiVersion: 2,
    ipcPrefixes: [],
  },
  "group-notice": {
    pluginId: "group-notice",
    version: "0.1.0",
    permissions: ["ui", "events", "storage", "network"],
    providesDomains: [{ domain: "group_notice", domainVersion: "1" }],
    entryApiVersion: 2,
    ipcPrefixes: [],
  },
  "ai-summary": {
    pluginId: "ai-summary",
    version: "0.1.0",
    // `ai`：允许使用客户端自配的 AI provider（密钥由宿主代持）；`network`：回退服务端端点；
    // `messages:read`：读取当前频道消息用于总结（只读当前频道，上限 500 条）。
    permissions: ["ui", "network", "storage", "ai", "messages:read"],
    providesDomains: [{ domain: "ai_summary", domainVersion: "1" }],
    entryApiVersion: 2,
    ipcPrefixes: [],
  },
};

/**
 * 默认启用的“自带插件”id 列表（单一真源）。
 *
 * 说明：
 * - 自带插件随宿主分发，dev 与 release 均默认启用（插件中心可见、运行时自动加载）；
 * - mock 模式下在查询已安装状态时幂等补齐 installed+enabled 条目；
 * - 本地源模式下，本地源中的默认插件会被合并进已安装列表；
 * - 补齐仅在“该插件无任何状态条目”时发生，用户显式 disable/uninstall 不会被覆盖。
 */
export const DEFAULT_ENABLED_PLUGIN_IDS: readonly string[] = [
  "theme",
  "markdown",
  "group-notice",
  "ai-summary",
];

/** 是否启用开发期本地 voice-call 插件源（旧开关，兼容保留；按当前 env 实时计算）。 */
export function useLocalVoiceCallPlugin(): boolean {
  return import.meta.env.VITE_USE_LOCAL_VOICE_CALL_PLUGIN === "true";
}

/**
 * 解析启用的本地（自带）插件源 id 列表。
 *
 * 规则（纯函数，便于测试 dev/release 行为一致）：
 * - `VITE_USE_LOCAL_PLUGINS` 为字符串：按逗号分隔解析（显式指定，可含 voice-call）；
 *   空字符串表示显式关闭本地源；
 * - 未设置：启用全部自带插件（`DEFAULT_ENABLED_PLUGIN_IDS`），dev 与 release 一致，
 *   否则 release 包会因为 `import.meta.env.DEV === false` 而看不到任何自带插件。
 *
 * @param raw - `import.meta.env.VITE_USE_LOCAL_PLUGINS` 的原始值。
 * @returns 启用的插件 id 列表。
 */
export function resolveEnabledLocalPluginIds(raw: string | undefined | null): readonly string[] {
  if (typeof raw === "string") {
    const ids = new Set<string>();
    for (const id of raw.split(",")) {
      const key = id.trim();
      if (key) ids.add(key);
    }
    if (useLocalVoiceCallPlugin()) ids.add("voice-call");
    return [...ids];
  }
  return [...DEFAULT_ENABLED_PLUGIN_IDS];
}

/**
 * 解析当前启用的本地（自带）插件源 id 列表（读取运行时 env）。
 *
 * @returns 启用的插件 id 列表。
 */
export function getEnabledLocalPluginIds(): readonly string[] {
  return resolveEnabledLocalPluginIds(import.meta.env.VITE_USE_LOCAL_PLUGINS);
}

/** 当前是否启用了任一本地插件源（按当前 env 实时计算，便于测试注入）。 */
export function useLocalPlugins(): boolean {
  return getEnabledLocalPluginIds().length > 0;
}

/**
 * 判断某插件是否命中自带（本地）插件源。
 *
 * @param pluginId - 插件 id。
 * @returns 命中本地源时为 `true`。
 */
export function isLocalPluginSourceEnabled(pluginId: string): boolean {
  const id = String(pluginId ?? "").trim();
  if (!id) return false;
  return getEnabledLocalPluginIds().includes(id);
}

/**
 * 获取自带（本地）插件源的 runtime entry。
 *
 * @param serverId - 服务器隔离 id。
 * @param pluginId - 插件 id。
 * @returns runtime entry。
 * @throws 插件不在本地源注册表中时抛错。
 */
export function getLocalPluginRuntimeEntry(serverId: string, pluginId: string): PluginRuntimeEntry {
  const id = String(pluginId ?? "").trim();
  const def = LOCAL_PLUGIN_SOURCES[id];
  if (!def) {
    throw new Error(`Local plugin source not found: ${id}`);
  }
  return {
    serverId,
    pluginId: def.pluginId,
    version: def.version,
    entry: `/plugins/${def.pluginId}/index.js`,
    permissions: def.permissions,
    providesDomains: def.providesDomains,
    minHostVersion: "0.0.0",
    entryApiVersion: def.entryApiVersion,
    ipcPrefixes: def.ipcPrefixes,
  };
}

/**
 * 获取“默认启用”且命中本地源注册表的插件 id 列表（用于 dev 本地源模式的安装态合并）。
 */
export function getDefaultLocalEnabledPluginIds(): readonly string[] {
  return DEFAULT_ENABLED_PLUGIN_IDS.filter((id) => id in LOCAL_PLUGIN_SOURCES);
}

/**
 * 本地源插件“停用/卸载”覆盖标记（localStorage，按 server key + 插件 id 隔离）。
 *
 * 说明：本地源插件的安装态是推导出来的（不落盘），停用/卸载意图通过该标记持久化，
 * 使插件中心的停用/卸载操作在 dev 下真实生效且跨刷新保留。
 */
const LOCAL_PLUGIN_DISABLED_KEY = "carrypigeon:localPluginDisabled:";

function localDisabledKey(serverSocket: string, pluginId: string): string {
  return `${LOCAL_PLUGIN_DISABLED_KEY}${normalizeServerKey(serverSocket)}:${pluginId}`;
}

/**
 * 查询某个本地源插件是否被用户显式停用/卸载。
 */
export function isLocalPluginDisabled(serverSocket: string, pluginId: string): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(localDisabledKey(serverSocket, pluginId)) !== null;
}

/**
 * 设置/清除本地源插件的停用标记。
 */
export function setLocalPluginDisabled(serverSocket: string, pluginId: string, disabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  const key = localDisabledKey(serverSocket, pluginId);
  if (disabled) localStorage.setItem(key, "1");
  else localStorage.removeItem(key);
}

/**
 * 列出本地源模式下应被视为“已安装且启用”的自带插件安装态。
 *
 * 说明：仅在本地源启用时返回非空列表；安装态版本以本地源注册表为准；
 * 被用户显式停用/卸载（localStorage 标记）的插件会被排除。
 *
 * @param serverSocket - 服务器 socket（用于停用标记隔离）。
 * @returns 已安装状态列表。
 */
export function listLocalDefaultInstalledStates(serverSocket: string): InstalledPluginState[] {
  if (!useLocalPlugins()) return [];
  return getDefaultLocalEnabledPluginIds()
    .filter((id) => isLocalPluginSourceEnabled(id))
    .filter((id) => !isLocalPluginDisabled(serverSocket, id))
    .map((id) => buildLocalInstalledState(id, true, "ok", ""));
}

/**
 * 构造本地源插件的安装态。
 */
function buildLocalInstalledState(
  pluginId: string,
  enabled: boolean,
  status: InstalledPluginState["status"],
  lastError: string,
): InstalledPluginState {
  const def = LOCAL_PLUGIN_SOURCES[pluginId];
  return {
    pluginId: def.pluginId,
    installedVersions: [def.version],
    currentVersion: def.version,
    enabled,
    status,
    lastError,
  };
}

/**
 * 读取本地源插件当前安装态（考虑停用标记）；不存在时返回 null。
 */
export function getLocalInstalledState(serverSocket: string, pluginId: string): InstalledPluginState | null {
  const id = String(pluginId ?? "").trim();
  if (!id || !(id in LOCAL_PLUGIN_SOURCES) || !isLocalPluginSourceEnabled(id)) return null;
  if (isLocalPluginDisabled(serverSocket, id)) return buildLocalInstalledState(id, false, "ok", "");
  return buildLocalInstalledState(id, true, "ok", "");
}

/**
 * 列出本地源插件的目录条目（用于插件中心目录合并）。
 *
 * 说明：
 * - 仅返回当前启用的本地源插件；目录展示信息（名称/描述/权限）取自 mock catalog，
 *   版本与下载可用性以本地源注册表为准；
 * - 该合并让插件中心在 dev 与 release（非 mock）下都能看到自带插件。
 *
 * @returns 目录条目列表。
 */
export function listLocalPluginCatalogEntries(): PluginCatalogEntry[] {
  return getEnabledLocalPluginIds()
    .filter((id) => id in LOCAL_PLUGIN_SOURCES)
    .map((id) => {
      const def = LOCAL_PLUGIN_SOURCES[id];
      const meta = MOCK_PLUGIN_CATALOG.find((p) => p.pluginId === id);
      return {
        pluginId: def.pluginId,
        name: meta?.name ?? id,
        tagline: meta?.tagline ?? "",
        description: meta?.description ?? "",
        homepage: meta?.homepage,
        source: "repo" as const,
        downloadUrl: meta?.downloadUrl,
        sha256: meta?.sha256 ?? "",
        required: false,
        versions: [def.version],
        versionEntries: [
          {
            version: def.version,
            source: "repo" as const,
            downloadUrl: meta?.downloadUrl,
            sha256: meta?.sha256 ?? "",
          },
        ],
        providesDomains: meta?.providesDomains ?? [],
        permissions: meta?.permissions ?? [],
      };
    });
}
