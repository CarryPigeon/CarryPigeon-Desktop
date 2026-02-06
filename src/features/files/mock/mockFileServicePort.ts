/**
 * @fileoverview mockFileServicePort.ts
 * @description files｜Mock 实现：mockFileServicePort（用于本地预览/测试）。
 */

import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { sleep } from "@/shared/mock/sleep";
import type { FileServicePort } from "../domain/ports/FileServicePort";
import type { FileUploadRequest, FileUploadResult, UploadDescriptor } from "../domain/types/FileTypes";

/**
 * Mock implementation of FileServicePort.
 *
 * @constant
 */
export const mockFileServicePort: FileServicePort = {
  async requestUpload(
    serverSocket: string,
    accessToken: string,
    request: FileUploadRequest,
  ): Promise<FileUploadResult> {
    void serverSocket;
    void accessToken;
    await sleep(MOCK_LATENCY_MS);

    const fileId = `mock-file-${Date.now()}`;
    const shareKey = `mock-share-${Date.now()}`;

    return {
      fileId,
      shareKey,
      upload: {
        method: "PUT",
        url: `https://mock-upload.example.com/${fileId}`,
        headers: { "Content-Type": request.mimeType },
        expiresAt: Date.now() + 3600000,
      },
    };
  },

  async performUpload(upload: UploadDescriptor, body: Blob | ArrayBuffer | Uint8Array): Promise<void> {
    void upload;
    void body;
    await sleep(MOCK_LATENCY_MS);
  },

  buildDownloadUrl(serverSocket: string, shareKey: string): string {
    void serverSocket;
    return `https://mock-download.example.com/${shareKey}`;
  },
};
