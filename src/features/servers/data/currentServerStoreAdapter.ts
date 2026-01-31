/**
 * @fileoverview currentServerStoreAdapter.ts 文件职责说明。
 */
import { getServerSocket, setServerSocket } from "../presentation/store/currentServerState";
import type { CurrentServerPort } from "../domain/ports/CurrentServerPort";

/**
 * Exported constant.
 * @constant
 */
export const currentServerStoreAdapter: CurrentServerPort = {
  /**
   * get method.
   * @returns TODO.
   */
  get(): string {
    return getServerSocket();
  },
  /**
   * set method.
   * @param serverSocket - TODO.
   */
  set(serverSocket: string): void {
    setServerSocket(serverSocket);
  },
};
