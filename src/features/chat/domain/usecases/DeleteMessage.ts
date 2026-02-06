/**
 * @fileoverview DeleteMessage.ts
 * @description chat｜用例：DeleteMessage。
 */

import type { ChatApiPort } from "../ports/chatApiPort";

/**
 * 用例：删除消息。
 */
export class DeleteMessage {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * 执行：删除指定消息。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param messageId - 消息 id。
   * @returns 无返回值。
   */
  execute(serverSocket: string, accessToken: string, messageId: string): Promise<void> {
    return this.api.deleteMessage(serverSocket, accessToken, messageId);
  }
}
