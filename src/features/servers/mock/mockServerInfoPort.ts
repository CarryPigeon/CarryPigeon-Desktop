/**
 * @fileoverview mockServerInfoPort.ts
 * @description Mock ServerInfoPort implementation for local UI preview.
 */

import type { ServerInfoPort } from "../domain/ports/ServerInfoPort";
import type { ServerInfo } from "../domain/types/serverInfo";
import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { sleep } from "@/shared/mock/sleep";
import { rememberServerId } from "@/shared/serverIdentity";

/**
 * Create a deterministic, URL-safe pseudo id from a string.
 *
 * This is used to emulate a stable server_id in mock mode.
 *
 * @param input - Raw string (server socket).
 * @returns A deterministic short id.
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
 * Mock server info port.
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
