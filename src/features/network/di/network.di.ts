/**
 * @fileoverview network.di.ts
 * @description network｜依赖组装（DI）：network.di。
 */

import { USE_MOCK_API } from "@/shared/config/runtime";
import { ConnectToServer } from "../domain/usecases/ConnectToServer";
import { mockTcpConnector } from "../mock/mockTcpConnector";
import { tauriTcpConnector } from "../data/tauriTcpConnector";

let connectToServer: ConnectToServer | null = null;

/**
 * 获取 `ConnectToServer` 用例（单例）。
 *
 * 选择规则（由 `USE_MOCK_API` 驱动）：
 * - mock：空实现连接器（用于 UI 预览/开发联调）
 * - tauri：真实 TCP 连接器（走 Tauri sidecar）
 *
 * @returns `ConnectToServer` 实例。
 */
export function getConnectToServerUsecase(): ConnectToServer {
  if (connectToServer) return connectToServer;
  connectToServer = new ConnectToServer(USE_MOCK_API ? mockTcpConnector : tauriTcpConnector);
  return connectToServer;
}
