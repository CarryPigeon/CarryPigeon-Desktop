/**
 * @fileoverview mockTcpConnector.ts
 * @description Mock TcpConnectorPort (no-op) for UI preview mode.
 */
import type { TcpConnectorPort } from "../domain/ports/TcpConnectorPort";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("mockTcpConnector");

/**
 * Mock connector that logs connect attempts and immediately resolves.
 *
 * @constant
 */
export const mockTcpConnector: TcpConnectorPort = {
  async connect(serverSocket: string): Promise<void> {
    logger.info("Mock connect server", { serverSocket });
    // No-op for mock mode.
    return;
  },
};
