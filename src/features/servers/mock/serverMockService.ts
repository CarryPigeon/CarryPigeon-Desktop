/**
 * @fileoverview serverMockService.ts 文件职责说明。
 */
import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import type { ServerData } from "@/features/servers/data/serverDataImpl";

const serverState = new Map<string, ServerData>();

/**
 * delay 方法说明。
 * @param ms - 参数说明。
 * @returns 返回值说明。
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * getState 方法说明。
 * @param socket - 参数说明。
 * @returns 返回值说明。
 */
function getState(socket: string): ServerData {
  const key = socket.trim();
  if (!serverState.has(key)) {
    serverState.set(key, {
      server_name: key || "Mock Server",
      avatar: "",
      brief: "Mock server data (local)",
      time: Date.now(),
    });
  }
  return serverState.get(key)!;
}

export class MockServerDataService {
  constructor(private readonly serverSocket: string) {}

  /**
   * getServerData method.
   * @returns TODO.
   */
  async getServerData(): Promise<ServerData> {
    await delay(MOCK_LATENCY_MS);
    return getState(this.serverSocket);
  }
}
