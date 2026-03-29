/**
 * @fileoverview ListChannelApplications.ts
 * @description chat｜用例：ListChannelApplications。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ChatChannelApplicationRecord } from "../types/chatApiModels";

export class ListChannelApplications {
  constructor(private readonly api: ChatApiPort) {}

  execute(serverSocket: string, accessToken: string, channelId: string): Promise<ChatChannelApplicationRecord[]> {
    return this.api.listChannelApplications(serverSocket, accessToken, channelId);
  }
}
