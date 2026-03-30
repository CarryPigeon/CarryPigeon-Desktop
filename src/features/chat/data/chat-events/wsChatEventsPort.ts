/**
 * @fileoverview wsChatEventsPort.ts
 * @description chat｜数据层实现：wsChatEventsPort。
 */

import type { ChatEventsClient, ChatEventsConnectOptions, ChatEventsPort } from "../../domain/ports/chatEventsPort";
import type { ChatEventEnvelope } from "../../domain/types/chatEventModels";
import { connectChatWs } from "./wsChatEvents";
import { mapChatWsEventWire } from "../protocol/chatWireMappers";

/**
 * chat 事件流端口实现。
 *
 * 该适配器只负责把底层 WebSocket 客户端输出的 wire event
 * 转换为领域事件 envelope，再交给上层 runtime 消费。
 */
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
