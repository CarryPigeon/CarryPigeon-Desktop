/**
 * @fileoverview ListChannels.ts
 * @description chat｜用例：ListChannels。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ChatChannelRecord } from "../types/chatApiModels";

export class ListChannels {
  constructor(private readonly api: ChatApiPort) {}

  execute(serverSocket: string, accessToken: string): Promise<ChatChannelRecord[]> {
    return this.api.listChannels(serverSocket, accessToken);
  }
}
