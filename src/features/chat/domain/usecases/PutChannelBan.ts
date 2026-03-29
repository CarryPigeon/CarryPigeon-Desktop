/**
 * @fileoverview PutChannelBan.ts
 * @description chat｜用例：PutChannelBan。
 */

import type { ChatApiPort } from "../ports/chatApiPort";

/**
 * 用例：设置频道封禁/禁言。
 */
export class PutChannelBan {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * 执行：设置频道封禁/禁言。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param channelId - 频道 id。
   * @param userId - 用户 id。
   * @param until - 截止时间戳（ms；0 表示永久）。
   * @param reason - 原因说明。
   * @returns 无返回值。
   */
  execute(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    userId: string,
    until: number,
    reason: string,
  ): Promise<void> {
    return this.api.putChannelBan(serverSocket, accessToken, channelId, userId, until, reason);
  }
}
