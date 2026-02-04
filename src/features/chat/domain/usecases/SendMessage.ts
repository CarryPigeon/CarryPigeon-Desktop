/**
 * @fileoverview SendMessage.ts
 * @description Usecase: send a message to a channel.
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { MessageDto, SendMessageRequestDto } from "../types/chatWireDtos";

/**
 * Send message usecase.
 */
export class SendMessage {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * Execute send message.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @param channelId - Channel id.
   * @param message - Message request payload.
   * @param idempotencyKey - Optional idempotency key.
   * @returns Created message.
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
