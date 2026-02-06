/**
 * @fileoverview ServerInfoPort.ts
 * @description servers｜领域端口：ServerInfoPort。
 */

import type { ServerInfo } from "../types/serverInfo";

/**
 * 服务端信息端口（领域层）。
 *
 * 实现说明：
 * - `mock`：用于本地 UI 预览的确定性实现
 * - `tauri`：通过 TCP/HTTP 从真实后端获取服务端信息
 */
export interface ServerInfoPort {
  /**
   * 获取指定 server socket 的服务端信息。
   *
   * @param serverSocket - 目标 server socket 字符串。
   * @returns 服务端信息（包含 `serverId` 等字段）。
   */
  getServerInfo(serverSocket: string): Promise<ServerInfo>;
}
