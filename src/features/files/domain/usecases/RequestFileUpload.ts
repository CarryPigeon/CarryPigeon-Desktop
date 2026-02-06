/**
 * @fileoverview RequestFileUpload.ts
 * @description files｜用例：RequestFileUpload。
 */

import type { FileServicePort } from "../ports/FileServicePort";
import type { FileUploadRequest, FileUploadResult } from "../types/FileTypes";

/**
 * 请求文件上传 descriptor 用例。
 */
export class RequestFileUpload {
  constructor(private readonly fileService: FileServicePort) {}

  /**
   * 执行请求上传 descriptor（两段式上传的第一段）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param request - 上传请求参数。
   * @returns 上传结果（包含 file_id/share_key 与 upload descriptor）。
   */
  execute(
    serverSocket: string,
    accessToken: string,
    request: FileUploadRequest,
  ): Promise<FileUploadResult> {
    return this.fileService.requestUpload(serverSocket, accessToken, request);
  }
}
