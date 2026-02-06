/**
 * @fileoverview mockServerInfoPort.ts
 * @description servers｜Mock 实现：mockServerInfoPort（用于本地预览/测试）。
 */

import type { ServerInfoPort } from "../domain/ports/ServerInfoPort";
import type { ServerInfo } from "../domain/types/serverInfo";
import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { sleep } from "@/shared/mock/sleep";
import { rememberServerId } from "@/shared/serverIdentity";

/**
 * 基于字符串生成确定性的、URL 安全的伪 id。
 *
 * 用途：在 mock 模式下模拟稳定的 `server_id`。
 *
 * @param input - 原始字符串（server socket）。
 * @returns 短 id（确定性）。
 */
function hashToId(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = (h >>> 0).toString(16).padStart(8, "0");
  return `mock-${n}`;
}

/**
 * Mock 的 `ServerInfoPort` 实现。
 *
 * @constant
 */
export const mockServerInfoPort: ServerInfoPort = {
  async getServerInfo(serverSocket: string): Promise<ServerInfo> {
    const socket = serverSocket.trim();
    await sleep(Math.min(220, MOCK_LATENCY_MS));
    if (!socket) {
      throw new Error("Missing server socket");
    }
    const serverId = hashToId(socket);
    rememberServerId(socket, serverId);
    return {
      serverId,
      name: socket.startsWith("mock://") ? "Mock Rack" : "CarryPigeon Server",
      brief: "Mock server info for UI preview. Replace with real `/core/server/data/get` response.",
      avatar: "",
      serverTimeMs: Date.now(),
    };
  },
};
