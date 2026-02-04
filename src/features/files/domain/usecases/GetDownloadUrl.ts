/**
 * @fileoverview GetDownloadUrl.ts
 * @description Usecase: build file download URL.
 */

import type { FileServicePort } from "../ports/FileServicePort";

/**
 * Get download URL usecase.
 */
export class GetDownloadUrl {
  constructor(private readonly fileService: FileServicePort) {}

  /**
   * Execute get download URL.
   *
   * @param serverSocket - Server socket.
   * @param shareKey - File share key.
   * @returns Absolute download URL.
   */
  execute(serverSocket: string, shareKey: string): string {
    return this.fileService.buildDownloadUrl(serverSocket, shareKey);
  }
}
