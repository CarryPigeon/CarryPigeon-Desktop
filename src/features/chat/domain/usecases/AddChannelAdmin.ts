/**
 * @fileoverview AddChannelAdmin.ts
 * @description chat｜用例：AddChannelAdmin。
 */

import type { ChatApiPort } from "../ports/chatApiPort";

/**
 * 用例：授予频道管理员。
 */
export class AddChannelAdmin {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * 执行：授予频道管理员。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param channelId - 频道 id。
   * @param userId - 用户 id。
   * @returns 无返回值。
   */
  execute(serverSocket: string, accessToken: string, channelId: string, userId: string): Promise<void> {
    return this.api.addChannelAdmin(serverSocket, accessToken, channelId, userId);
  }
}
