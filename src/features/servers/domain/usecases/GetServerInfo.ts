/**
 * @fileoverview GetServerInfo.ts
 * @description servers｜用例：GetServerInfo。
 */

import type { ServerInfoPort } from "../ports/ServerInfoPort";
import type { ServerInfo } from "../types/serverInfo";

/**
 * 获取服务器信息用例。
 */
export class GetServerInfo {
  constructor(private readonly port: ServerInfoPort) {}

  /**
   * 执行：通过 server socket 获取服务器信息。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @returns 解析后的 `ServerInfo`。
   */
  execute(serverSocket: string): Promise<ServerInfo> {
    return this.port.getServerInfo(serverSocket);
  }
}
