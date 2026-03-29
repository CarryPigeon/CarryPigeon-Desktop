/**
 * @fileoverview GetUnreads.ts
 * @description chat｜用例：GetUnreads。
 */

import type { ChatApiPort } from "../ports/chatApiPort";
import type { ChatUnreadState } from "../types/chatApiModels";

export class GetUnreads {
  constructor(private readonly api: ChatApiPort) {}

  execute(serverSocket: string, accessToken: string): Promise<ChatUnreadState[]> {
    return this.api.getUnreads(serverSocket, accessToken);
  }
}
