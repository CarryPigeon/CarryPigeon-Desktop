/**
 * @fileoverview server-connection/rack 对外 API。
 * @description
 * 统一暴露服务器目录（rack）与 socket/TLS 选择能力。
 *
 * 说明：
 * - `rack` 子域只负责“有哪些 server、当前选中哪个 server、该 server 用什么 TLS 配置”；
 * - 不负责连接状态、server-info 拉取或 scope 清理。
 */

import {
  addRackServer,
  getCurrentRackSocket,
  getRackTlsConfig,
  listRackDirectory,
  selectRackSocket,
  startRackRuntime,
  stopRackRuntime,
  type ServerRack,
  type ServerTlsConfig,
} from "./application/rackDirectoryService";

export type RackCapabilities = {
  startRuntime(): void;
  stopRuntime(): void;
  getCurrentSocket(): string;
  listDirectory(): readonly ServerRack[];
  getTlsConfig(serverSocket: string): ServerTlsConfig;
  selectSocket(serverSocket: string): void;
  addServer(serverSocket: string, name: string): void;
};

/**
 * 创建 rack 子域能力对象。
 */
export function createRackCapabilities(): RackCapabilities {
  return {
    startRuntime: startRackRuntime,
    stopRuntime: stopRackRuntime,
    getCurrentSocket: getCurrentRackSocket,
    listDirectory: listRackDirectory,
    getTlsConfig: getRackTlsConfig,
    selectSocket: selectRackSocket,
    addServer: addRackServer,
  };
}

let rackCapabilitiesSingleton: RackCapabilities | null = null;

/**
 * 获取 rack 子域共享能力对象。
 */
export function getRackCapabilities(): RackCapabilities {
  rackCapabilitiesSingleton ??= createRackCapabilities();
  return rackCapabilitiesSingleton;
}

export type { ServerRack, ServerTlsConfig };
