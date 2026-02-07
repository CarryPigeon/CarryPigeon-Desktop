/**
 * @fileoverview mockTcpConnector.ts
 * @description network｜Mock 实现：mockTcpConnector（用于本地预览/测试）。
 */
import type { TcpConnectorPort } from "../domain/ports/TcpConnectorPort";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("mockTcpConnector");

/**
 * mock 连接器：记录连接尝试并立即成功返回。
 *
 * @constant
 */
export const mockTcpConnector: TcpConnectorPort = {
  async connect(serverSocket: string): Promise<void> {
    logger.info("Action: network_mock_server_connect_started", { serverSocket });
    // No-op for mock mode.
    return;
  },
};
