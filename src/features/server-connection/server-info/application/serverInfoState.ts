/**
 * @fileoverview server-connection/server-info application facade。
 * @description
 * 收敛 server-info 子域的运行时与快照读取能力，避免公共 API 直接依赖展示层 store。
 */

import type { ServerInfo } from "../domain/types/serverInfo";
import {
  startServerInfoRuntime,
  stopServerInfoRuntime,
  useServerInfoStore,
} from "../presentation/store/serverInfoStore";

function getServerInfoStore(serverSocket: string) {
  return useServerInfoStore(serverSocket);
}

export function startServerInfoStateRuntime(): void {
  startServerInfoRuntime();
}

export function stopServerInfoStateRuntime(): void {
  stopServerInfoRuntime();
}

export function refreshServerInfo(serverSocket: string): Promise<void> {
  return getServerInfoStore(serverSocket).refresh();
}

export function getServerInfoSnapshot(serverSocket: string): ServerInfo | null {
  return getServerInfoStore(serverSocket).info.value;
}

export function getServerInfoLoading(serverSocket: string): boolean {
  return getServerInfoStore(serverSocket).loading.value;
}

export function getServerInfoError(serverSocket: string): string {
  return getServerInfoStore(serverSocket).error.value;
}
