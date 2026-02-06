/**
 * @fileoverview ListChannels.ts
 * @description chat｜用例：ListChannels。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ChannelDto } from "../types/chatWireDtos";

/**
 * 用例：获取频道列表。
 */
export class ListChannels {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * 执行：获取当前用户可见的频道列表。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @returns 频道列表。
   */
  execute(serverSocket: string, accessToken: string): Promise<ChannelDto[]> {
    return this.api.listChannels(serverSocket, accessToken);
  }
}
