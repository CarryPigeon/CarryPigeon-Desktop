/**
 * @fileoverview installedPluginsPayload.ts
 * @description account/auth-flow｜辅助函数：构造 required-gate 相关的 installed_plugins 载荷。
 */

import { queryInstalledPlugins } from "./installedPluginsQueryProvider";

/**
 * required-gate 请求中的插件声明条目。
 */
export type InstalledPluginPayload = {
  plugin_id: string;
  version: string;
};

/**
 * 构造“已安装且启用”的插件声明列表。
 *
 * 规则：
 * - 仅包含 `enabled=true` 且 `status=ok` 且存在 `currentVersion` 的插件；
 * - 默认以 best-effort 方式工作：读取失败时返回空列表。
 *
 * @param serverSocket - 服务端 socket。
 * @param options - 可选配置。
 * @returns installed_plugins 载荷列表。
 */
export async function buildInstalledPluginsPayload(
  serverSocket: string,
  options?: { bestEffort?: boolean },
): Promise<InstalledPluginPayload[]> {
  const socket = String(serverSocket ?? "").trim();
  if (!socket) return [];
  const bestEffort = options?.bestEffort !== false;

  try {
    const installed = await queryInstalledPlugins(socket);
    const out: InstalledPluginPayload[] = [];
    for (const p of installed) {
      const ok = Boolean(p.enabled) && p.status === "ok" && Boolean(p.currentVersion);
      if (!ok) continue;
      out.push({ plugin_id: p.pluginId, version: String(p.currentVersion) });
    }
    return out;
  } catch (e) {
    if (bestEffort) return [];
    throw e;
  }
}
