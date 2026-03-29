/**
 * @fileoverview server-connection/rack application facade。
 * @description
 * 收敛 rack 子域的目录读写与 TLS 查询能力，避免公共 API 直接依赖展示层 store。
 */

import {
  addServer as addServerInternal,
  currentServerSocket,
  getTlsConfigForSocket,
  serverRacks,
  setServerSocket,
  startServerRackRuntime,
  stopServerRackRuntime,
  type ServerRack,
  type ServerTlsConfig,
} from "../presentation/store";

export type { ServerRack, ServerTlsConfig } from "../presentation/store";

export function startRackRuntime(): void {
  startServerRackRuntime();
}

export function stopRackRuntime(): void {
  stopServerRackRuntime();
}

export function getCurrentRackSocket(): string {
  return currentServerSocket.value;
}

export function listRackDirectory(): readonly ServerRack[] {
  return serverRacks.value;
}

export function getRackTlsConfig(serverSocket: string): ServerTlsConfig {
  return getTlsConfigForSocket(serverSocket);
}

export function selectRackSocket(serverSocket: string): void {
  setServerSocket(serverSocket);
}

export function addRackServer(serverSocket: string, name: string): void {
  addServerInternal(serverSocket, name);
}
