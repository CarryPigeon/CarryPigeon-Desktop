/**
 * @fileoverview httpFileServicePort.ts
 * @description HTTP implementation of FileServicePort.
 */

import type { FileServicePort } from "../domain/ports/FileServicePort";
import type { FileUploadRequest, FileUploadResult, UploadDescriptor } from "../domain/types/FileTypes";
import { httpRequestFileUpload, httpPerformFileUpload, buildFileDownloadUrl } from "./httpFileApi";

/**
 * HTTP implementation of FileServicePort.
 *
 * @constant
 */
export const httpFileServicePort: FileServicePort = {
  async requestUpload(
    serverSocket: string,
    accessToken: string,
    request: FileUploadRequest,
  ): Promise<FileUploadResult> {
    const res = await httpRequestFileUpload(serverSocket, accessToken, {
      filename: request.filename,
      mime_type: request.mimeType,
      size_bytes: request.sizeBytes,
      sha256: request.sha256,
    });
    return {
      fileId: res.file_id,
      shareKey: res.share_key,
      upload: {
        method: res.upload.method,
        url: res.upload.url,
        headers: res.upload.headers,
        expiresAt: res.upload.expires_at,
      },
    };
  },

  async performUpload(upload: UploadDescriptor, body: Blob | ArrayBuffer | Uint8Array): Promise<void> {
    await httpPerformFileUpload(
      {
        method: upload.method,
        url: upload.url,
        headers: upload.headers,
        expires_at: upload.expiresAt,
      },
      body,
    );
  },

  buildDownloadUrl(serverSocket: string, shareKey: string): string {
    return buildFileDownloadUrl(serverSocket, shareKey);
  },
};
