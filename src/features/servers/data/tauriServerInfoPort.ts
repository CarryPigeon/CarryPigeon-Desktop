/**
 * @fileoverview tauriServerInfoPort.ts
 * @description Tauri/TCP-backed ServerInfoPort implementation.
 *
 * Protocol reference:
 * - `design/protocol/PROTOCOL-OVERVIEW.md` (server_id source)
 * - Suggested route: `/core/server/data/get` (TCP or HTTP equivalent)
 */

import type { ServerInfoPort } from "../domain/ports/ServerInfoPort";
import type { ServerInfo } from "../domain/types/serverInfo";
import { BaseAPI } from "@/shared/net/BaseAPI";
import { createLogger } from "@/shared/utils/logger";
import { rememberServerId } from "@/shared/serverIdentity";

const logger = createLogger("tauriServerInfoPort");

/**
 * Minimal TCP API wrapper for server info.
 *
 * The transport mapping is handled by `BaseAPI` (TCP request/response wrapper).
 */
class ServerInfoApi extends BaseAPI {
  /**
   * Fetch server info from the backend.
   *
   * @returns ServerInfo payload mapped to domain shape.
   */
  get(): Promise<ServerInfo> {
    return this.send("/core/server/data/get", undefined, (raw) => mapServerInfo(raw));
  }
}

/**
 * Map a raw server response into the domain `ServerInfo` shape.
 *
 * This mapper is defensive because different server versions may use slightly
 * different field names.
 *
 * @param raw - Response `data` payload from the transport.
 * @returns Parsed `ServerInfo`.
 */
function mapServerInfo(raw: unknown): ServerInfo {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid server info payload");
  }
  const obj = raw as Record<string, unknown>;
  const serverId = String(obj.server_id ?? obj.serverId ?? obj.id ?? "").trim();
  const name = String(obj.name ?? obj.server_name ?? "Server").trim() || "Server";
  const brief = String(obj.brief ?? obj.description ?? obj.bio ?? "").trim();
  const avatar = typeof obj.avatar === "string" ? obj.avatar : "";
  const serverTimeMs = typeof obj.server_time === "number" ? obj.server_time : typeof obj.serverTimeMs === "number" ? obj.serverTimeMs : undefined;
  return { serverId, name, brief, avatar, serverTimeMs };
}

/**
 * Tauri server info port.
 *
 * @constant
 */
export const tauriServerInfoPort: ServerInfoPort = {
  async getServerInfo(serverSocket: string): Promise<ServerInfo> {
    const socket = serverSocket.trim();
    if (!socket) throw new Error("Missing server socket");
    try {
      const info = await new ServerInfoApi(socket).get();
      if (info.serverId) rememberServerId(socket, info.serverId);
      return info;
    } catch (e) {
      logger.error("Get server info failed", { socket, error: String(e) });
      throw e;
    }
  },
};
