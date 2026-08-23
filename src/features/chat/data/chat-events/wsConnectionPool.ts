/**
 * @fileoverview WebSocket 连接登记表。
 * @description
 * 仅追踪当前已建立的 chat WS 连接（register / unregister）。
 * 不再做连接复用、预热或 LRU 驱逐——实际生命周期由 wsChatEvents 管理。
 */

import { createLogger } from "@/shared/utils/logger";
import type { ChatWsClient } from "./wsChatEvents";

const logger = createLogger("ws_connection_pool");

const registry = new Map<string, ChatWsClient>();

/**
 * WebSocket 连接登记表。
 */
class WsConnectionRegistry {
  /**
   * 登记已建立的连接（不接管 close）。
   */
  registerConnection(socket: string, client: ChatWsClient): void {
    registry.set(socket, client);
    logger.debug("Action: network_ws_connection_registered", {
      socket,
      size: registry.size,
    });
  }

  /**
   * 注销连接（不调用 client.close）。
   */
  unregisterConnection(socket: string): void {
    if (registry.delete(socket)) {
      logger.debug("Action: network_ws_connection_unregistered", {
        socket,
        size: registry.size,
      });
    }
  }
}

let globalRegistry: WsConnectionRegistry | null = null;

/**
 * 获取全局 WebSocket 连接登记表。
 */
export function getWsConnectionPool(): WsConnectionRegistry {
  globalRegistry ??= new WsConnectionRegistry();
  return globalRegistry;
}

/**
 * 清空全局登记表。
 */
export function destroyWsConnectionPool(): void {
  registry.clear();
  globalRegistry = null;
}
