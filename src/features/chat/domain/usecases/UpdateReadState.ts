/**
 * @fileoverview UpdateReadState.ts
 * @description chat｜用例：UpdateReadState。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ChatReadStateInput } from "../types/chatApiModels";

export class UpdateReadState {
  constructor(private readonly api: ChatApiPort) {}

  execute(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    readState: ChatReadStateInput,
  ): Promise<void> {
    return this.api.updateReadState(serverSocket, accessToken, channelId, readState);
  }
}
