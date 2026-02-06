/**
 * @fileoverview PatchChannel.ts
 * @description chat｜用例：PatchChannel。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ChannelDto } from "../types/chatWireDtos";

/**
 * 用例：更新频道信息（patch）。
 */
export class PatchChannel {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * 执行：对频道执行部分字段更新。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param channelId - 频道 id。
   * @param patch - patch 对象（仅允许更新 `name/brief/avatar`）。
   * @returns 更新后的频道信息。
   */
  execute(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    patch: Partial<Pick<ChannelDto, "name" | "brief" | "avatar">>,
  ): Promise<ChannelDto> {
    return this.api.patchChannel(serverSocket, accessToken, channelId, patch);
  }
}
