/**
 * @fileoverview mockTcpConnector.ts 文件职责说明。
 */
import type { TcpConnectorPort } from "../domain/ports/TcpConnectorPort";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("mockTcpConnector");

/**
 * Exported constant.
 * @constant
 */
export const mockTcpConnector: TcpConnectorPort = {
  /**
   * connect method.
   * @param serverSocket - TODO.
   * @param _opts - TODO.
   * @returns TODO.
   */
  async connect(serverSocket: string): Promise<void> {
    logger.info("Mock connect server", { serverSocket });
    // No-op for mock mode.
    return;
  },
};
