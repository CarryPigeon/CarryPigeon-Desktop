/**
 * @fileoverview GetServerInfo.ts
 * @description Usecase: retrieve server `server_id` and basic info through `ServerInfoPort`.
 */

import type { ServerInfoPort } from "../ports/ServerInfoPort";
import type { ServerInfo } from "../types/serverInfo";

export class GetServerInfo {
  constructor(private readonly port: ServerInfoPort) {}

  /**
   * Fetch server info by socket.
   *
   * @param serverSocket - Target server socket.
   * @returns Resolved `ServerInfo`.
   */
  execute(serverSocket: string): Promise<ServerInfo> {
    return this.port.getServerInfo(serverSocket);
  }
}

