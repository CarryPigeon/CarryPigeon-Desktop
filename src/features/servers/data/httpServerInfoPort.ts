/**
 * @fileoverview httpServerInfoPort.ts
 * @description HTTP-backed `ServerInfoPort` implementation for the `/api/server` endpoint.
 *
 * API doc reference:
 * - See `docs/api/*` → `GET /api/server`
 *
 * Notes:
 * - This adapter is used when the app is configured to talk to an HTTP+WS server.
 * - It maps server fields into the domain `ServerInfo` shape.
 */

import type { ServerInfoPort } from "../domain/ports/ServerInfoPort";
import type { ServerInfo } from "../domain/types/serverInfo";
import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";
import { createLogger } from "@/shared/utils/logger";
import { rememberServerId } from "@/shared/serverIdentity";

const logger = createLogger("httpServerInfoPort");

type ApiServerResponse = {
  server_id: string;
  name: string;
  brief?: string;
  avatar?: string;
  api_version?: string;
  min_supported_api_version?: string;
  ws_url?: string;
  required_plugins?: string[];
  capabilities?: Record<string, unknown>;
  server_time?: number;
};

/**
 * Map `/api/server` response into the domain `ServerInfo`.
 *
 * @param raw - Raw API response.
 * @returns Domain `ServerInfo`.
 */
function mapServerInfo(raw: ApiServerResponse): ServerInfo {
  const serverId = String(raw.server_id ?? "").trim();
  const name = String(raw.name ?? "Server").trim() || "Server";
  const brief = String(raw.brief ?? "").trim();
  const avatar = typeof raw.avatar === "string" ? raw.avatar : "";
  const apiVersion = typeof raw.api_version === "string" ? raw.api_version : undefined;
  const minSupportedApiVersion = typeof raw.min_supported_api_version === "string" ? raw.min_supported_api_version : undefined;
  const wsUrl = typeof raw.ws_url === "string" ? raw.ws_url : undefined;
  const requiredPlugins = Array.isArray(raw.required_plugins)
    ? raw.required_plugins.map((x) => String(x).trim()).filter(Boolean)
    : undefined;
  const capabilities = raw.capabilities && typeof raw.capabilities === "object" ? (raw.capabilities as Record<string, unknown>) : undefined;
  const serverTimeMs = typeof raw.server_time === "number" ? raw.server_time : undefined;
  return { serverId, name, brief, avatar, apiVersion, minSupportedApiVersion, wsUrl, requiredPlugins, capabilities, serverTimeMs };
}

/**
 * HTTP ServerInfoPort implementation.
 *
 * @constant
 */
export const httpServerInfoPort: ServerInfoPort = {
  async getServerInfo(serverSocket: string): Promise<ServerInfo> {
    const socket = serverSocket.trim();
    if (!socket) throw new Error("Missing server socket");
    const client = new HttpJsonClient({ serverSocket: socket, apiVersion: 1 });
    try {
      const raw = await client.requestJson<ApiServerResponse>("GET", "/server");
      const info = mapServerInfo(raw);
      if (info.serverId) rememberServerId(socket, info.serverId);
      return info;
    } catch (e) {
      logger.error("Get server info failed", { socket, error: String(e) });
      throw e;
    }
  },
};
