/**
 * @fileoverview ListChannelMessages.ts
 * @description Usecase: fetch paginated messages for a channel.
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ListMessagesResponseDto } from "../types/chatWireDtos";

/**
 * List channel messages usecase.
 */
export class ListChannelMessages {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * Execute list channel messages.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @param channelId - Channel id.
   * @param cursor - Optional cursor.
   * @param limit - Page size.
   * @returns Page response.
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
