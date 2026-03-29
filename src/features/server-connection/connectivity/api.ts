/**
 * @fileoverview server-connection/connectivity 对外 API。
 * @description
 * 暴露连接状态与连接动作，供登录页/聊天页/设置页协作。
 *
 * 说明：
 * - `connectivity` 只暴露连接相关公共面；
 * - `TcpService`、frame codec、request registry 等仍属于内部实现细节。
 */

import {
  connectNow,
  connectWithRetry,
  getConnectivitySnapshot,
  retryLastConnection,
  startConnectivityRuntime,
  stopConnectivityRuntime,
  type ConnectionPhase,
  type ConnectionReason,
  type ConnectivitySnapshot,
} from "./application/connectivityService";

export type ConnectivityCapabilities = {
  startRuntime(): Promise<void>;
  stopRuntime(): Promise<void>;
  getSnapshot(): ConnectivitySnapshot;
  connectNow(serverSocket: string): Promise<void>;
  connectWithRetry(
    serverSocket: string,
    options?: {
      maxAttempts?: number;
      maxDelayMs?: number;
      baseDelayMs?: number;
    },
  ): Promise<void>;
  retry(): Promise<void>;
};

/**
 * 创建 connectivity 子域能力对象。
 */
export function createConnectivityCapabilities(): ConnectivityCapabilities {
  return {
    startRuntime: startConnectivityRuntime,
    stopRuntime: stopConnectivityRuntime,
    getSnapshot: getConnectivitySnapshot,
    connectNow,
    connectWithRetry,
    retry: retryLastConnection,
  };
}

let connectivityCapabilitiesSingleton: ConnectivityCapabilities | null = null;

/**
 * 获取 connectivity 子域共享能力对象。
 */
export function getConnectivityCapabilities(): ConnectivityCapabilities {
  connectivityCapabilitiesSingleton ??= createConnectivityCapabilities();
  return connectivityCapabilitiesSingleton;
}

export type { ConnectionPhase, ConnectionReason };
