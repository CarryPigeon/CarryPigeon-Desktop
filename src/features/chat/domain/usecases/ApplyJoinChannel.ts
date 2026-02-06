/**
 * @fileoverview ApplyJoinChannel.ts
 * @description chat｜用例：ApplyJoinChannel。
 */

import type { ChatApiPort } from "../ports/chatApiPort";

/**
 * 用例：申请加入频道。
 */
export class ApplyJoinChannel {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * 执行：提交入群申请。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param channelId - 频道 id。
   * @param reason - 申请理由（可选，空字符串表示无理由）。
   * @returns 无返回值。
   */
  execute(serverSocket: string, accessToken: string, channelId: string, reason: string): Promise<void> {
    return this.api.applyJoinChannel(serverSocket, accessToken, channelId, reason);
  }
}
