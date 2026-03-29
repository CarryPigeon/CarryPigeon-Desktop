/**
 * @fileoverview installedPluginsQueryProvider.ts
 * @description account/auth-flow｜installed_plugins 查询 provider（由 app composition root 注入）。
 */

type InstalledPluginLike = {
  pluginId: string;
  currentVersion?: string | null;
  enabled?: boolean;
  status?: string;
};

export type InstalledPluginsQueryProvider = (serverSocket: string) => Promise<InstalledPluginLike[]>;

let provider: InstalledPluginsQueryProvider | null = null;

/**
 * 注册 installed_plugins 查询 provider。
 *
 * @param next - provider 实现。
 */
export function setInstalledPluginsQueryProvider(next: InstalledPluginsQueryProvider): void {
  provider = next;
}

/**
 * 查询当前 server 下已安装插件状态（best-effort）。
 *
 * @param serverSocket - 服务端 socket。
 * @returns 插件状态列表。
 */
export async function queryInstalledPlugins(serverSocket: string): Promise<InstalledPluginLike[]> {
  const socket = String(serverSocket ?? "").trim();
  if (!socket || !provider) return [];
  try {
    const list = await provider(socket);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
