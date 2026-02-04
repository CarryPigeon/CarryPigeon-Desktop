/**
 * @fileoverview PerformFileUpload.ts
 * @description Usecase: perform file upload using descriptor.
 */

import type { FileServicePort } from "../ports/FileServicePort";
import type { UploadDescriptor } from "../types/FileTypes";

/**
 * Perform file upload usecase.
 */
export class PerformFileUpload {
  constructor(private readonly fileService: FileServicePort) {}

  /**
   * Execute perform file upload.
   *
   * @param upload - Upload descriptor.
   * @param body - Binary payload.
   * @returns Promise<void>.
   */
  execute(upload: UploadDescriptor, body: Blob | ArrayBuffer | Uint8Array): Promise<void> {
    return this.fileService.performUpload(upload, body);
  }
}
