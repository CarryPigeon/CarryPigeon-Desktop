/**
 * @fileoverview 文件管理页读取当前活动 server socket。
 * @description
 * 文件列表按 server 隔离。当前选中 socket 来自 server-connection workspace；
 * 若内存中尚未选中（例如浏览器刷新后），回退到机架目录中的置顶/第一项并同步选中。
 */

import { getServerConnectionCapabilities } from "@/features/server-connection/api";

/**
 * 读取文件管理应使用的 server socket。
 *
 * @returns 规范化后的 socket；没有任何可用服务器时返回空字符串。
 */
export function readActiveFileServerSocket(): string {
  const workspace = getServerConnectionCapabilities().workspace;
  const current = workspace.readSocket().trim();
  if (current) return current;
  const racks = workspace.listDirectory();
  const fallback = String(
    racks.find((rack) => Boolean(rack.pinned))?.serverSocket ?? racks[0]?.serverSocket ?? "",
  ).trim();
  if (fallback) workspace.selectSocket(fallback);
  return fallback;
}
