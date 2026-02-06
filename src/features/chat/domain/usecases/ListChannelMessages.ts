/**
 * @fileoverview ListChannelMessages.ts
 * @description chat｜用例：ListChannelMessages。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ListMessagesResponseDto } from "../types/chatWireDtos";

/**
 * 用例：分页拉取频道消息。
 */
export class ListChannelMessages {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * 执行：按游标分页获取频道消息。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param channelId - 频道 id。
   * @param cursor - 游标（可选，空/undefined 表示从最新或默认位置开始）。
   * @param limit - 每页条数（可选）。
   * @returns 分页响应。
   */
  execute(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    cursor?: string,
    limit?: number,
  ): Promise<ListMessagesResponseDto> {
    return this.api.listChannelMessages(serverSocket, accessToken, channelId, cursor, limit);
  }
}
