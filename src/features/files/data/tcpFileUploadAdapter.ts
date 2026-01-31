/**
 * @fileoverview tcpFileUploadAdapter.ts 文件职责说明。
 */
import { TCP_SERVICE } from "../../network/data/tcp";
import type { FileUploadPort } from "../domain/ports/FileUploadPort";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("tcpFileUploadAdapter");

type FileUploadCommand = {
  size: number;
  sha256: string;
};

/**
 * Exported constant.
 * @constant
 */
export const tcpFileUploadAdapter: FileUploadPort = {
  /**
   * requestUpload method.
   * @returns TODO.
   */
  async requestUpload({ serverSocket, size, sha256 }) {
    const service = TCP_SERVICE.get(serverSocket);
    if (!service) {
      logger.error("TcpService not found", { serverSocket });
      return;
    }

    const payload: FileUploadCommand = { size, sha256 };
    await service.send(serverSocket, JSON.stringify(payload));
  },
};
