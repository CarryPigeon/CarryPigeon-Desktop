/**
 * @fileoverview UpdateReadState.ts
 * @description chat｜用例：UpdateReadState。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ReadStateRequestDto } from "../types/chatWireDtos";

/**
 * 用例：更新频道读状态。
 */
export class UpdateReadState {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * 执行：上报当前频道读状态。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param channelId - 频道 id。
   * @param readState - 读状态数据（由协议层 DTO 定义）。
   * @returns 无返回值。
   */
  execute(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    readState: ReadStateRequestDto,
  ): Promise<void> {
    return this.api.updateReadState(serverSocket, accessToken, channelId, readState);
  }
}
