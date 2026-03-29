/**
 * @fileoverview KickChannelMember.ts
 * @description chat｜用例：KickChannelMember。
 */

import type { ChatApiPort } from "../ports/chatApiPort";

/**
 * 用例：将成员踢出频道。
 */
export class KickChannelMember {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * 执行：将成员踢出频道。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param channelId - 频道 id。
   * @param userId - 用户 id。
   * @returns 无返回值。
   */
  execute(serverSocket: string, accessToken: string, channelId: string, userId: string): Promise<void> {
    return this.api.kickChannelMember(serverSocket, accessToken, channelId, userId);
  }
}
