/**
 * @fileoverview FileServicePort.ts
 * @description files｜领域端口：FileServicePort。
 *
 * 实现说明：
 * - `mock`：用于 UI 预览/开发联调的模拟实现
 * - `http`：基于后端 API 的真实实现
 */

import type { FileUploadRequest, FileUploadResult, UploadDescriptor } from "../types/FileTypes";

/**
 * 文件服务端口（领域层）。
 */
export interface FileServicePort {
  /**
   * 请求文件上传的 upload descriptor（两段式上传的第一段）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param request - 上传请求参数。
   * @returns 上传结果（包含 file_id/share_key 与 upload descriptor）。
   */
  requestUpload(
    serverSocket: string,
    accessToken: string,
    request: FileUploadRequest,
  ): Promise<FileUploadResult>;

  /**
   * 使用 upload descriptor 执行实际上传（两段式上传的第二段）。
   *
   * @param upload - upload descriptor。
   * @param body - 二进制载荷（Blob/ArrayBuffer/Uint8Array）。
   */
  performUpload(upload: UploadDescriptor, body: Blob | ArrayBuffer | Uint8Array): Promise<void>;

  /**
   * 构建 share key 对应的绝对下载 URL。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param shareKey - 文件 share key。
   * @returns 绝对下载 URL。
   */
  buildDownloadUrl(serverSocket: string, shareKey: string): string;
}
