/**
 * @fileoverview network.di.ts
 * @description Composition root for network feature.
 */

import { USE_MOCK_API } from "@/shared/config/runtime";
import { ConnectToServer } from "../domain/usecases/ConnectToServer";
import { mockTcpConnector } from "../mock/mockTcpConnector";
import { tauriTcpConnector } from "../data/tauriTcpConnector";

let connectToServer: ConnectToServer | null = null;

/**
 * Get a singleton `ConnectToServer` usecase.
 *
 * Implementation choice is driven by `USE_MOCK_API`:
 * - mock: no-op connector (UI preview)
 * - tauri: real TCP connector
 *
 * @returns Usecase instance.
 */
export function getConnectToServerUsecase(): ConnectToServer {
  if (connectToServer) return connectToServer;
  connectToServer = new ConnectToServer(USE_MOCK_API ? mockTcpConnector : tauriTcpConnector);
  return connectToServer;
}
