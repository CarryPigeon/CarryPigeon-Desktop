/**
 * @fileoverview PerformFileUpload.ts
 * @description shared/file-transfer｜用例：PerformFileUpload。
 */

import type { FileServicePort } from "../fileServicePort";
import type { UploadDescriptor } from "../types";

/**
 * 执行文件上传用例。
 */
export class PerformFileUpload {
  constructor(private readonly fileService: FileServicePort) {}

  /**
   * 执行实际上传（两段式上传的第二段）。
   *
   * @param upload - upload descriptor。
   * @param body - 二进制载荷（Blob/ArrayBuffer/Uint8Array）。
   * @returns Promise<void>。
   */
  execute(upload: UploadDescriptor, body: Blob | ArrayBuffer | Uint8Array): Promise<void> {
    return this.fileService.performUpload(upload, body);
  }
}
