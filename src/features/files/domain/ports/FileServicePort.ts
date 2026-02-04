/**
 * @fileoverview FileServicePort.ts
 * @description Domain port: file upload/download operations.
 *
 * Implementations:
 * - `mock`: simulated file operations for UI preview
 * - `http`: real HTTP-backed file service
 */

import type { FileUploadRequest, FileUploadResult, UploadDescriptor } from "../types/FileTypes";

/**
 * File service port.
 */
export interface FileServicePort {
  /**
   * Request an upload descriptor for a file.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Access token.
   * @param request - Upload request details.
   * @returns Upload descriptor with file id and share key.
   */
  requestUpload(
    serverSocket: string,
    accessToken: string,
    request: FileUploadRequest,
  ): Promise<FileUploadResult>;

  /**
   * Perform the actual upload using the provided descriptor.
   *
   * @param upload - Upload descriptor.
   * @param body - Binary payload.
   */
  performUpload(upload: UploadDescriptor, body: Blob | ArrayBuffer | Uint8Array): Promise<void>;

  /**
   * Build the absolute download URL for a share key.
   *
   * @param serverSocket - Server socket.
   * @param shareKey - File share key.
   * @returns Absolute URL.
   */
  buildDownloadUrl(serverSocket: string, shareKey: string): string;
}
