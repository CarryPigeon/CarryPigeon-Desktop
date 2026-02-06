/**
 * @fileoverview GetUnreads.ts
 * @description chat｜用例：GetUnreads。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { UnreadItemDto } from "../types/chatWireDtos";

/**
 * 用例：获取未读统计列表。
 */
export class GetUnreads {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * 执行：获取各频道未读计数/未读状态。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @returns 未读列表。
   */
  execute(serverSocket: string, accessToken: string): Promise<UnreadItemDto[]> {
    return this.api.getUnreads(serverSocket, accessToken);
  }
}
