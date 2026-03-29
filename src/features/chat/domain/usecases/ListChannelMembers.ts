/**
 * @fileoverview ListChannelMembers.ts
 * @description chat｜用例：ListChannelMembers。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ChatChannelMemberRecord } from "../types/chatApiModels";

export class ListChannelMembers {
  constructor(private readonly api: ChatApiPort) {}

  execute(serverSocket: string, accessToken: string, channelId: string): Promise<ChatChannelMemberRecord[]> {
    return this.api.listChannelMembers(serverSocket, accessToken, channelId);
  }
}
