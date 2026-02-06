/**
 * @fileoverview tauriServerInfoPort.ts
 * @description servers｜数据层实现：tauriServerInfoPort。
 *
 * 协议参考：
 * - `design/protocol/PROTOCOL-OVERVIEW.md`（server_id 来源）
 * - 推荐路由：`/core/server/data/get`（TCP 或 HTTP 等价）
 */

import type { ServerInfoPort } from "../domain/ports/ServerInfoPort";
import type { ServerInfo } from "../domain/types/serverInfo";
import { BaseAPI } from "@/shared/net/BaseAPI";
import { createLogger } from "@/shared/utils/logger";
import { rememberServerId } from "@/shared/serverIdentity";

const logger = createLogger("tauriServerInfoPort");

/**
 * server info 的最小 TCP API 包装。
 *
 * 说明：传输映射由 `BaseAPI` 负责（TCP request/response 包装）。
 */
class ServerInfoApi extends BaseAPI {
  /**
   * 从服务端拉取 server info。
   *
   * @returns 映射到领域结构后的 `ServerInfo`。
   */
  get(): Promise<ServerInfo> {
    return this.send("/core/server/data/get", undefined, (raw) => mapServerInfo(raw));
  }
}

/**
 * 将服务端响应映射为领域 `ServerInfo` 结构。
 *
 * 防御性说明：不同服务端版本可能使用不同字段名，本 mapper 会做 best-effort 兼容。
 *
 * @param raw - 传输层响应的 `data` 载荷。
 * @returns 解析后的 `ServerInfo`。
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
 * Tauri 的 `ServerInfoPort` 实现。
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
      logger.error("Action: get_server_info_failed", { socket, error: String(e) });
      throw e;
    }
  },
};
