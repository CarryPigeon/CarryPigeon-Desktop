/**
 * @fileoverview PatchChannel.ts
 * @description Usecase: patch channel metadata.
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ChannelDto } from "../types/chatWireDtos";

/**
 * Patch channel usecase.
 */
export class PatchChannel {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * Execute patch channel.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @param channelId - Channel id.
   * @param patch - Patch object.
   * @returns Updated channel.
   */
  execute(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    patch: Partial<Pick<ChannelDto, "name" | "brief" | "avatar">>,
  ): Promise<ChannelDto> {
    return this.api.patchChannel(serverSocket, accessToken, channelId, patch);
  }
}
