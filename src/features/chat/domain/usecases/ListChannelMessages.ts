/**
 * @fileoverview ListChannelMessages.ts
 * @description chat｜用例：ListChannelMessages。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ChatMessagePage } from "../types/chatApiModels";

export class ListChannelMessages {
  constructor(private readonly api: ChatApiPort) {}

  execute(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    cursor?: string,
    limit?: number,
  ): Promise<ChatMessagePage> {
    return this.api.listChannelMessages(serverSocket, accessToken, channelId, cursor, limit);
  }
}
