/**
 * @fileoverview ConnectChatEvents.ts
 * @description Usecase: establish chat event stream connection.
 */

import type { ChatEventsPort, ChatEventsClient, ChatEventsConnectOptions } from "../ports/chatEventsPort";
import type { WsEventDto } from "../types/chatWireEvents";

/**
 * Connect chat events usecase.
 */
export class ConnectChatEvents {
  constructor(private readonly events: ChatEventsPort) {}

  /**
   * Execute connect to chat events.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @param onEvent - Event envelope callback.
   * @param options - Optional connection callbacks.
   * @returns Client handle.
   */
  execute(
    serverSocket: string,
    accessToken: string,
    onEvent: (evt: WsEventDto) => void,
    options?: ChatEventsConnectOptions,
  ): ChatEventsClient {
    return this.events.connect(serverSocket, accessToken, onEvent, options);
  }
}
