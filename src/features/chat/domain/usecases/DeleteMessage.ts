/**
 * @fileoverview DeleteMessage.ts
 * @description Usecase: hard delete a message.
 */

import type { ChatApiPort } from "../ports/chatApiPort";

/**
 * Delete message usecase.
 */
export class DeleteMessage {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * Execute delete message.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @param messageId - Message id.
   * @returns Promise<void>.
   */
  execute(serverSocket: string, accessToken: string, messageId: string): Promise<void> {
    return this.api.deleteMessage(serverSocket, accessToken, messageId);
  }
}
