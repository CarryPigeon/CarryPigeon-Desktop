/**
 * @fileoverview tcpPushChannelAdapter.ts 文件职责说明。
 */
import { TCP_SERVICE } from "../../network/data/tcp";
import type { PushChannelPort } from "../domain/ports/PushChannelPort";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("tcpPushChannelAdapter");

/**
 * Exported constant.
 * @constant
 */
export const tcpPushChannelAdapter: PushChannelPort = {
  /**
   * forwardChannelMessage method.
   * @returns TODO.
   */
  async forwardChannelMessage({ channelSocket, message }) {
    const service = TCP_SERVICE.get(channelSocket);
    if (!service) {
      logger.error("TcpService not found", { channelSocket });
      return;
    }

    const parsed = JSON.parse(message);
    await service.send(channelSocket, parsed);
  },
};
