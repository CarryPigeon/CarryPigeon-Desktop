/**
 * @fileoverview ListChannels.ts
 * @description Usecase: list channels visible to current user.
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ChannelDto } from "../types/chatWireDtos";

/**
 * List channels usecase.
 */
export class ListChannels {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * Execute list channels.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @returns Channels list.
   */
  execute(serverSocket: string, accessToken: string): Promise<ChannelDto[]> {
    return this.api.listChannels(serverSocket, accessToken);
  }
}
