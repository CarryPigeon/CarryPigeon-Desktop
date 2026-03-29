/**
 * @fileoverview DeleteChannelBan.ts
 * @description chat｜用例：DeleteChannelBan。
 */

import type { ChatApiPort } from "../ports/chatApiPort";

/**
 * 用例：解除频道封禁/禁言。
 */
export class DeleteChannelBan {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * 执行：解除频道封禁/禁言。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param channelId - 频道 id。
   * @param userId - 用户 id。
   * @returns 无返回值。
   */
  execute(serverSocket: string, accessToken: string, channelId: string, userId: string): Promise<void> {
    return this.api.deleteChannelBan(serverSocket, accessToken, channelId, userId);
  }
}
