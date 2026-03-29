/**
 * @fileoverview SendMessage.ts
 * @description chat｜用例：SendMessage。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ChatMessageRecord, ChatSendMessageInput } from "../types/chatApiModels";

export class SendMessage {
  constructor(private readonly api: ChatApiPort) {}

  execute(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    message: ChatSendMessageInput,
    idempotencyKey?: string,
  ): Promise<ChatMessageRecord> {
    return this.api.sendChannelMessage(serverSocket, accessToken, channelId, message, idempotencyKey);
  }
}
