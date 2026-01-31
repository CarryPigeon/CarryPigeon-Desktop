/**
 * @fileoverview connectServer.di.ts 文件职责说明。
 */
import { ConnectServer } from "../domain/usecases/ConnectServer";
import { USE_MOCK_API } from "@/shared/config/runtime";
import { tauriTcpConnector } from "../../network/data/tauriTcpConnector";
import { mockTcpConnector } from "../../network/mock/mockTcpConnector";
import { currentServerStoreAdapter } from "../../servers/data/currentServerStoreAdapter";

let instance: ConnectServer | null = null;

/**
 * getConnectServerUsecase 方法说明。
 * @returns 返回值说明。
 */
export function getConnectServerUsecase(): ConnectServer {
  if (instance) return instance;
  const connector = USE_MOCK_API ? mockTcpConnector : tauriTcpConnector;
  instance = new ConnectServer(connector, currentServerStoreAdapter);
  return instance;
}
