/**
 * @fileoverview GetDownloadUrl.ts
 * @description files｜用例：GetDownloadUrl。
 */

import type { FileServicePort } from "../ports/FileServicePort";

/**
 * 获取下载 URL 用例。
 */
export class GetDownloadUrl {
  constructor(private readonly fileService: FileServicePort) {}

  /**
   * 构建 share key 对应的下载 URL。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param shareKey - 文件 share key。
   * @returns 绝对下载 URL。
   */
  execute(serverSocket: string, shareKey: string): string {
    return this.fileService.buildDownloadUrl(serverSocket, shareKey);
  }
}
