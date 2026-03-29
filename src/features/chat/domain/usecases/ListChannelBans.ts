/**
 * @fileoverview ListChannelBans.ts
 * @description chat｜用例：ListChannelBans。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ChatChannelBanRecord } from "../types/chatApiModels";

export class ListChannelBans {
  constructor(private readonly api: ChatApiPort) {}

  execute(serverSocket: string, accessToken: string, channelId: string): Promise<ChatChannelBanRecord[]> {
    return this.api.listChannelBans(serverSocket, accessToken, channelId);
  }
}
