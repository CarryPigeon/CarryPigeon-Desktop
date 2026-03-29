/**
 * @fileoverview wsChatEventsPort.ts
 * @description chat｜数据层实现：wsChatEventsPort。
 */

import type { ChatEventsClient, ChatEventsConnectOptions, ChatEventsPort } from "../../domain/ports/chatEventsPort";
import type { ChatEventEnvelope } from "../../domain/types/chatEventModels";
import { connectChatWs } from "./wsChatEvents";
import { mapChatWsEventWire } from "../protocol/chatWireMappers";

export const wsChatEventsPort: ChatEventsPort = {
  connect(
    serverSocket: string,
    accessToken: string,
    onEvent: (evt: ChatEventEnvelope) => void,
    options?: ChatEventsConnectOptions,
  ): ChatEventsClient {
    return connectChatWs(serverSocket, accessToken, (env) => onEvent(mapChatWsEventWire(env.data)), options);
  },
};
