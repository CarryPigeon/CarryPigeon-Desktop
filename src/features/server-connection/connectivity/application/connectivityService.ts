/**
 * @fileoverview server-connection/connectivity application facade。
 * @description
 * 收敛 connectivity 子域对外可见的运行时、状态与命令，避免公共 API 直接依赖 presentation/data。
 */

import { startTcpRuntime, stopTcpRuntime } from "../data/tcp";
import {
  connectNow as connectNowInternal,
  connectWithRetry as connectWithRetryInternal,
  connectionDetail,
  connectionPhase,
  connectionPillState,
  connectionReason,
  retryLast as retryLastInternal,
  startConnectionRuntime as startConnectionRuntimeInternal,
  stopConnectionRuntime as stopConnectionRuntimeInternal,
  type ConnectionPhase,
  type ConnectionReason,
} from "../presentation/store/connectionStore";

export type ConnectivitySnapshot = {
  phase: ConnectionPhase;
  reason: ConnectionReason;
  detail: string;
  pillState: "connected" | "reconnecting" | "offline";
};

export type ConnectivityRetryOptions = {
  maxAttempts?: number;
  maxDelayMs?: number;
  baseDelayMs?: number;
};

export type { ConnectionPhase, ConnectionReason } from "../presentation/store/connectionStore";

export async function startConnectivityRuntime(): Promise<void> {
  await startTcpRuntime();
  await startConnectionRuntimeInternal();
}

export async function stopConnectivityRuntime(): Promise<void> {
  stopConnectionRuntimeInternal();
  await stopTcpRuntime();
}

export function getConnectivitySnapshot(): ConnectivitySnapshot {
  return {
    phase: connectionPhase.value,
    reason: connectionReason.value,
    detail: connectionDetail.value,
    pillState: connectionPillState.value,
  };
}

export function connectNow(serverSocket: string): Promise<void> {
  return connectNowInternal(serverSocket);
}

export function connectWithRetry(serverSocket: string, options?: ConnectivityRetryOptions): Promise<void> {
  return connectWithRetryInternal(serverSocket, options);
}

export function retryLastConnection(): Promise<void> {
  return retryLastInternal();
}
