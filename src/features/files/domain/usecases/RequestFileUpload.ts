/**
 * @fileoverview RequestFileUpload.ts
 * @description Usecase: request file upload descriptor.
 */

import type { FileServicePort } from "../ports/FileServicePort";
import type { FileUploadRequest, FileUploadResult } from "../types/FileTypes";

/**
 * Request file upload usecase.
 */
export class RequestFileUpload {
  constructor(private readonly fileService: FileServicePort) {}

  /**
   * Execute request file upload.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Access token.
   * @param request - Upload request details.
   * @returns Upload descriptor with file id and share key.
   */
  execute(
    serverSocket: string,
    accessToken: string,
    request: FileUploadRequest,
  ): Promise<FileUploadResult> {
    return this.fileService.requestUpload(serverSocket, accessToken, request);
  }
}
