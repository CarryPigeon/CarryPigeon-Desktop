/**
 * @fileoverview DeleteChannel.ts
 * @description chat｜用例：DeleteChannel。
 */

import type { ChatApiPort } from "../ports/chatApiPort";

/**
 * 用例：删除频道。
 */
export class DeleteChannel {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * 执行：删除频道。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param channelId - 频道 id。
   * @returns 无返回值。
   */
  execute(serverSocket: string, accessToken: string, channelId: string): Promise<void> {
    return this.api.deleteChannel(serverSocket, accessToken, channelId);
  }
}
