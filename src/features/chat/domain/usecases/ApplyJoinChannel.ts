/**
 * @fileoverview ApplyJoinChannel.ts
 * @description Usecase: apply/join a channel.
 */

import type { ChatApiPort } from "../ports/chatApiPort";

/**
 * Apply join channel usecase.
 */
export class ApplyJoinChannel {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * Execute apply join channel.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @param channelId - Channel id.
   * @param reason - Optional reason.
   * @returns Promise<void>.
   */
  execute(serverSocket: string, accessToken: string, channelId: string, reason: string): Promise<void> {
    return this.api.applyJoinChannel(serverSocket, accessToken, channelId, reason);
  }
}
