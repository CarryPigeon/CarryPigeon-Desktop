/**
 * @fileoverview CreateChannel.ts
 * @description chat｜用例：CreateChannel。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ChatChannelCreateInput, ChatChannelRecord } from "../types/chatApiModels";

export class CreateChannel {
  constructor(private readonly api: ChatApiPort) {}

  execute(
    serverSocket: string,
    accessToken: string,
    request: ChatChannelCreateInput,
  ): Promise<ChatChannelRecord> {
    return this.api.createChannel(serverSocket, accessToken, request);
  }
}
