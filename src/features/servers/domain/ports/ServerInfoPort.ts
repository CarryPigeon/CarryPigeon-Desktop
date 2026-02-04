/**
 * @fileoverview ServerInfoPort.ts
 * @description Domain port: fetch server basic info and stable `server_id`.
 */

import type { ServerInfo } from "../types/serverInfo";

/**
 * Server info port.
 *
 * Implementations:
 * - `mock`: deterministic server info for local UI preview
 * - `tauri`: TCP/HTTP-backed server info from real backend
 */
export interface ServerInfoPort {
  /**
   * Fetch server info for a given socket.
   *
   * @param serverSocket - Target server socket string.
   * @returns Server info including `serverId`.
   */
  getServerInfo(serverSocket: string): Promise<ServerInfo>;
}

