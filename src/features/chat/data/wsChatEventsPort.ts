/**
 * @fileoverview wsChatEventsPort.ts
 * @description chat｜数据层实现：wsChatEventsPort。
 */

import type { ChatEventsClient, ChatEventsConnectOptions, ChatEventsPort } from "../domain/ports/chatEventsPort";
import type { WsEventDto } from "../domain/types/chatWireEvents";
import { connectChatWs } from "./wsChatEvents";

/**
 * WS-backed chat events port.
 *
 * @constant
 */
export const wsChatEventsPort: ChatEventsPort = {
  connect(
    serverSocket: string,
    accessToken: string,
    onEvent: (evt: WsEventDto) => void,
    options?: ChatEventsConnectOptions,
  ): ChatEventsClient {
    return connectChatWs(serverSocket, accessToken, (env) => onEvent(env.data), options);
  },
};
