/**
 * @fileoverview ConnectChatEvents.ts
 * @description chat｜用例：ConnectChatEvents。
 */

import type { ChatEventsPort, ChatEventsClient, ChatEventsConnectOptions } from "../ports/chatEventsPort";
import type { WsEventDto } from "../types/chatWireEvents";

/**
 * 用例：连接聊天事件流（WS）。
 */
export class ConnectChatEvents {
  constructor(private readonly events: ChatEventsPort) {}

  /**
   * 执行：建立事件流连接，并通过回调传递服务端事件封包。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param onEvent - 事件回调（接收 WS 事件封包）。
   * @param options - 连接选项与回调（可选，例如 onOpen/onClose 等）。
   * @returns 客户端句柄（用于主动断开/释放）。
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
