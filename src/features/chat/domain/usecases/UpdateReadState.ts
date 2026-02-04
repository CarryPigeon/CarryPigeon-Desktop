/**
 * @fileoverview UpdateReadState.ts
 * @description Usecase: update read state for a channel.
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ReadStateRequestDto } from "../types/chatWireDtos";

/**
 * Update read state usecase.
 */
export class UpdateReadState {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * Execute update read state.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @param channelId - Channel id.
   * @param readState - Read state payload.
   * @returns Promise<void>.
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
