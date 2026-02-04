/**
 * @fileoverview GetUnreads.ts
 * @description Usecase: get per-channel unread counters.
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { UnreadItemDto } from "../types/chatWireDtos";

/**
 * Get unreads usecase.
 */
export class GetUnreads {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * Execute get unreads.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @returns Unread list.
   */
  execute(serverSocket: string, accessToken: string): Promise<UnreadItemDto[]> {
    return this.api.getUnreads(serverSocket, accessToken);
  }
}
