/**
 * @fileoverview SendMessage.ts
 * @description chat｜用例：SendMessage。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { MessageDto, SendMessageRequestDto } from "../types/chatWireDtos";

/**
 * 用例：发送消息。
 */
export class SendMessage {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * 执行：发送频道消息。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param channelId - 频道 id。
   * @param message - 消息请求体（由协议层 DTO 定义）。
   * @param idempotencyKey - 幂等 key（可选，用于避免重复发送）。
   * @returns 服务端回填后的消息。
   */
  execute(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    message: SendMessageRequestDto,
    idempotencyKey?: string,
  ): Promise<MessageDto> {
    return this.api.sendChannelMessage(serverSocket, accessToken, channelId, message, idempotencyKey);
  }
}
