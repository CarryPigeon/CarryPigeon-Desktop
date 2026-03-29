/**
 * @fileoverview ConnectChatEvents.ts
 * @description chat｜用例：ConnectChatEvents。
 */

import type { ChatEventsPort, ChatEventsClient, ChatEventsConnectOptions } from "../ports/chatEventsPort";
import type { ChatEventEnvelope } from "../types/chatEventModels";

export class ConnectChatEvents {
  constructor(private readonly events: ChatEventsPort) {}

  execute(
    serverSocket: string,
    accessToken: string,
    onEvent: (evt: ChatEventEnvelope) => void,
    options?: ChatEventsConnectOptions,
  ): ChatEventsClient {
    return this.events.connect(serverSocket, accessToken, onEvent, options);
  }
}
