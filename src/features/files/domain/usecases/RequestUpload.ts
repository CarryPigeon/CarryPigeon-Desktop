/**
 * @fileoverview RequestUpload.ts 文件职责说明。
 */
import type { FileUploadPort, RequestUploadArgs } from "../ports/FileUploadPort";

export class RequestUpload {
  constructor(private readonly files: FileUploadPort) {}

  /**
   * execute method.
   * @param args - TODO.
   * @returns TODO.
   */
  execute(args: RequestUploadArgs): Promise<void> {
    return this.files.requestUpload(args);
  }
}

