/**
 * @fileoverview TcpConnectorPort 的 Tauri 实现（data 层）。
 * @description 通过 `crateServerTcpService` 创建并握手 TCP 连接。
 */
import { crateServerTcpService } from "./TcpService";
import type { TcpConnectorPort } from "../domain/ports/TcpConnectorPort";
import { createLogger } from "@/shared/utils/logger";
import { ensureServerDb } from "@/shared/db";

const logger = createLogger("tauriTcpConnector");

/**
 * @constant
 * @description 基于 Tauri 的 TCP 连接器适配器（实现 domain port）。
 */
export const tauriTcpConnector: TcpConnectorPort = {
  /**
   * connect method.
   * @param serverSocket - TODO.
   * @param opts - TODO.
   * @returns TODO.
   */
  async connect(serverSocket: string): Promise<void> {
    logger.info("Connect server", { serverSocket });
    try {
      await Promise.all([
        ensureServerDb(serverSocket),
        crateServerTcpService(serverSocket),
      ]);
      logger.info("Connect server success", { serverSocket });
    } catch (e) {
      logger.error("Connect server failed", { serverSocket, error: String(e) });
      throw e;
    }
  },
};
