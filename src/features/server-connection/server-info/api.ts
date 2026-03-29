/**
 * @fileoverview server-connection/server-info 对外 API。
 * @description
 * 暴露当前服务器信息读取与刷新能力。
 *
 * 说明：
 * - `server-info` 只负责按 socket 读取与缓存 `/api/server`；
 * - 是否把它解释成“当前 workspace 信息”由上层 `workspace/api.ts` 决定。
 */

import type { ServerInfo } from "./domain/types/serverInfo";
import {
  getServerInfoError,
  getServerInfoLoading,
  getServerInfoSnapshot,
  refreshServerInfo,
  startServerInfoStateRuntime,
  stopServerInfoStateRuntime,
} from "./application/serverInfoState";

export type ServerInfoCapabilities = {
  startRuntime(): void;
  stopRuntime(): void;
  refresh(serverSocket: string): Promise<void>;
  getSnapshot(serverSocket: string): ServerInfo | null;
  getLoading(serverSocket: string): boolean;
  getError(serverSocket: string): string;
};

/**
 * 创建 server-info 子域能力对象。
 */
export function createServerInfoCapabilities(): ServerInfoCapabilities {
  return {
    startRuntime: startServerInfoStateRuntime,
    stopRuntime: stopServerInfoStateRuntime,
    refresh: refreshServerInfo,
    getSnapshot: getServerInfoSnapshot,
    getLoading: getServerInfoLoading,
    getError: getServerInfoError,
  };
}

let serverInfoCapabilitiesSingleton: ServerInfoCapabilities | null = null;

/**
 * 获取 server-info 子域共享能力对象。
 */
export function getServerInfoCapabilities(): ServerInfoCapabilities {
  serverInfoCapabilitiesSingleton ??= createServerInfoCapabilities();
  return serverInfoCapabilitiesSingleton;
}
