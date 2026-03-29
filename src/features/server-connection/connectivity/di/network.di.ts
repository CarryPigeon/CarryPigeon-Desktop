/**
 * @fileoverview network.di.ts
 * @description server-connection/connectivity｜依赖组装（DI）：network.di。
 */

import { selectByMockMode } from "@/shared/config/mockModeSelector";
import { ConnectToServer } from "../domain/usecases/ConnectToServer";
import { mockTcpConnector } from "../mock/mockTcpConnector";
import { tauriTcpConnector } from "../data/tauriTcpConnector";

let connectToServer: ConnectToServer | null = null;

/**
 * 获取 `ConnectToServer` 用例（单例）。
 *
 * 选择规则（由 mock 启用状态驱动）：
 * - `store`：空实现连接器（用于 UI 预览/开发联调）
 * - `off/protocol`：真实 TCP 连接器（走 Tauri sidecar）
 *
 * @returns `ConnectToServer` 实例。
 */
export function getConnectToServerUsecase(): ConnectToServer {
  if (connectToServer) return connectToServer;
  connectToServer = new ConnectToServer(
    selectByMockMode({
      off: () => tauriTcpConnector,
      store: () => mockTcpConnector,
      protocol: () => tauriTcpConnector,
    }),
  );
  return connectToServer;
}
