/**
 * @fileoverview PatchChannel.ts
 * @description chat｜用例：PatchChannel。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ChatChannelPatchInput, ChatChannelRecord } from "../types/chatApiModels";

export class PatchChannel {
  constructor(private readonly api: ChatApiPort) {}

  execute(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    patch: ChatChannelPatchInput,
  ): Promise<ChatChannelRecord> {
    return this.api.patchChannel(serverSocket, accessToken, channelId, patch);
  }
}
