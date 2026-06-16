/**
 * @fileoverview WebSocket 连接池管理器
 * @description
 * 提供连接复用、连接状态缓存和智能重连策略，优化 WebSocket 连接性能。
 */

import { createLogger } from "@/shared/utils/logger";
import type { ChatWsClient, ChatWsConnectOptions } from "./wsChatEvents";

const logger = createLogger("ws_connection_pool");

/**
 * WebSocket 连接池中缓存的连接项。
 */
type ConnectionPoolItem = {
  /**
   * 服务器 socket 标识。
   */
  socket: string;
  /**
   * WebSocket 客户端句柄。
   */
  client: ChatWsClient;
  /**
   * 连接创建时间戳。
   */
  createdAt: number;
  /**
   * 最后活跃时间戳（用于 LRU 清理）。
   */
  lastActiveAt: number;
  /**
   * 连接状态。
   */
  status: "connecting" | "connected" | "disconnected" | "error";
  /**
   * 引用计数（用于确定何时可以清理连接）。
   */
  refCount: number;
  /**
   * 关闭标记（用户主动关闭）。
   */
  closedByUser: boolean;
};

/**
 * WebSocket 连接池配置。
 */
type ConnectionPoolConfig = {
  /**
   * 最大连接数。
   */
  maxConnections: number;
  /**
   * 连接闲置超时时间（毫秒），超过此时间的闲置连接将被清理。
   */
  idleTimeoutMs: number;
  /**
   * 连接最大生命周期（毫秒），超过此时间的连接将被强制重建。
   */
  maxLifetimeMs: number;
  /**
   * 是否启用连接池预热（在后台预建立连接）。
   */
  enablePrewarming: boolean;
};

/**
 * 默认连接池配置。
 */
const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  maxConnections: 5,
  idleTimeoutMs: 10 * 60 * 1000, // 10分钟
  maxLifetimeMs: 30 * 60 * 1000, // 30分钟
  enablePrewarming: true,
};

/**
 * WebSocket 连接池管理器。
 */
export class WsConnectionPool {
  private pool = new Map<string, ConnectionPoolItem>();
  private config: ConnectionPoolConfig;
  private cleanupTimer: number | null = null;

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
    this.startCleanupTimer();
    logger.info("Action: network_ws_pool_initialized", {
      maxConnections: this.config.maxConnections,
      idleTimeoutMs: this.config.idleTimeoutMs,
      maxLifetimeMs: this.config.maxLifetimeMs,
    });
  }

  /**
   * 启动连接池清理定时器。
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cleanupTimer = window.setInterval(() => {
      this.cleanupIdleConnections();
    }, 60 * 1000); // 每分钟清理一次
  }

  /**
   * 停止连接池清理定时器。
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 清理闲置连接。
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const socketsToClean: string[] = [];

    for (const [socket, item] of this.pool.entries()) {
      const idleTime = now - item.lastActiveAt;
      const lifetime = now - item.createdAt;

      // 清理条件：闲置超时 或 生命周期超时 且 无引用
      if (
        item.refCount === 0 &&
        !item.closedByUser &&
        (idleTime > this.config.idleTimeoutMs || lifetime > this.config.maxLifetimeMs)
      ) {
        socketsToClean.push(socket);
      }
    }

    if (socketsToClean.length > 0) {
      logger.info("Action: network_ws_pool_cleanup", {
        cleaned: socketsToClean.length,
        sockets: socketsToClean,
      });
      socketsToClean.forEach((socket) => this.removeConnection(socket));
    }
  }

  /**
   * 添加或更新连接到池中。
   */
  private addOrUpdateConnection(
    socket: string,
    client: ChatWsClient,
    initialRefCount: number = 1
  ): void {
    const existing = this.pool.get(socket);
    const now = Date.now();

    if (existing) {
      // 更新现有连接
      existing.client = client;
      existing.refCount += initialRefCount;
      existing.lastActiveAt = now;
      existing.status = "connected";
      existing.closedByUser = false;
      logger.debug("Action: network_ws_pool_connection_updated", {
        socket,
        refCount: existing.refCount,
      });
    } else {
      // 创建新连接
      const newItem: ConnectionPoolItem = {
        socket,
        client,
        createdAt: now,
        lastActiveAt: now,
        status: "connected",
        refCount: initialRefCount,
        closedByUser: false,
      };

      // 检查是否超过最大连接数
      if (this.pool.size >= this.config.maxConnections) {
        this.evictLeastRecentlyUsed();
      }

      this.pool.set(socket, newItem);
      logger.info("Action: network_ws_pool_connection_added", {
        socket,
        poolSize: this.pool.size,
        refCount: initialRefCount,
      });
    }
  }

  /**
   * 从池中移除连接。
   */
  private removeConnection(socket: string): void {
    const item = this.pool.get(socket);
    if (item) {
      try {
        item.client.close();
      } catch (error) {
        logger.warn("Action: network_ws_pool_connection_close_failed", {
          socket,
          error: String(error),
        });
      }
      this.pool.delete(socket);
      logger.debug("Action: network_ws_pool_connection_removed", {
        socket,
        poolSize: this.pool.size,
      });
    }
  }

  /**
   * 驱逐最少使用的连接（LRU）。
   */
  private evictLeastRecentlyUsed(): void {
    let oldestSocket: string | null = null;
    let oldestTime = Infinity;

    for (const [socket, item] of this.pool.entries()) {
      if (item.refCount === 0 && item.lastActiveAt < oldestTime) {
        oldestTime = item.lastActiveAt;
        oldestSocket = socket;
      }
    }

    if (oldestSocket) {
      logger.info("Action: network_ws_pool_evict_lru", {
        socket: oldestSocket,
        lastActiveAt: oldestTime,
      });
      this.removeConnection(oldestSocket);
    }
  }

  /**
   * 获取或创建 WebSocket 连接。
   *
   * @param socket - 服务器 socket 标识
   * @param createClient - 创建客户端的函数
   * @param options - 连接选项
   * @returns WebSocket 客户端句柄
   */
  async getOrCreateConnection(
    socket: string,
    createClient: (options: ChatWsConnectOptions) => ChatWsClient,
    options: ChatWsConnectOptions = {}
  ): Promise<ChatWsClient> {
    const existing = this.pool.get(socket);

    if (existing && existing.status === "connected" && !existing.closedByUser) {
      // 复用现有连接
      existing.refCount++;
      existing.lastActiveAt = Date.now();
      logger.info("Action: network_ws_pool_connection_reused", {
        socket,
        refCount: existing.refCount,
      });
      return existing.client;
    }

    // 创建新连接
    logger.info("Action: network_ws_pool_connection_creating", {
      socket,
      poolSize: this.pool.size,
    });

    const item = this.pool.get(socket);
    if (item) {
      item.status = "connecting";
      item.createdAt = Date.now();
    }

    const client = createClient(options);
    this.addOrUpdateConnection(socket, client);

    return client;
  }

  /**
   * 释放连接引用。
   *
   * @param socket - 服务器 socket 标识
   */
  releaseConnection(socket: string): void {
    const item = this.pool.get(socket);
    if (item) {
      item.refCount = Math.max(0, item.refCount - 1);
      item.lastActiveAt = Date.now();
      logger.debug("Action: network_ws_pool_connection_released", {
        socket,
        refCount: item.refCount,
      });

      // 如果引用计数为0，标记为可清理
      if (item.refCount === 0) {
        logger.info("Action: network_ws_pool_connection_no_refs", {
          socket,
        });
      }
    }
  }

  /**
   * 主动关闭连接。
   *
   * @param socket - 服务器 socket 标识
   */
  closeConnection(socket: string): void {
    const item = this.pool.get(socket);
    if (item) {
      item.closedByUser = true;
      this.removeConnection(socket);
      logger.info("Action: network_ws_pool_connection_closed_by_user", {
        socket,
      });
    }
  }

  /**
   * 关闭所有连接。
   */
  closeAllConnections(): void {
    const sockets = Array.from(this.pool.keys());
    logger.info("Action: network_ws_pool_closing_all", {
      count: sockets.length,
    });
    sockets.forEach((socket) => this.closeConnection(socket));
  }

  /**
   * 注册已建立的连接到池中（仅追踪，不调用 client.close）。
   *
   * 用于连接池外创建的连接（如 chat events），将连接纳入池的监控和统计。
   *
   * @param socket - 服务器 socket 标识
   * @param client - 已建立的客户端句柄
   */
  registerConnection(socket: string, client: ChatWsClient): void {
    const existing = this.pool.get(socket);
    const now = Date.now();

    if (existing) {
      // 刷新已有连接的活跃状态
      existing.client = client;
      existing.lastActiveAt = now;
      existing.status = "connected";
      existing.closedByUser = false;
      logger.debug("Action: network_ws_pool_connection_refreshed", { socket });
    } else {
      // 添加新连接到池中统一监控
      if (this.pool.size >= this.config.maxConnections) {
        this.evictLeastRecentlyUsed();
      }

      this.pool.set(socket, {
        socket,
        client,
        createdAt: now,
        lastActiveAt: now,
        status: "connected",
        refCount: 1,
        closedByUser: false,
      });

      logger.info("Action: network_ws_pool_connection_registered", {
        socket,
        poolSize: this.pool.size,
      });
    }
  }

  /**
   * 从池中注销连接（不调用 client.close，由调用方自行管理关闭）。
   *
   * 与 `closeConnection` 不同，此方法仅移除追踪记录，不重复关闭连接。
   *
   * @param socket - 服务器 socket 标识
   */
  unregisterConnection(socket: string): void {
    const removed = this.pool.delete(socket);
    if (removed) {
      logger.debug("Action: network_ws_pool_connection_unregistered", {
        socket,
        poolSize: this.pool.size,
      });
    }
  }

  /**
   * 预热连接（在后台预先建立连接）。
   *
   * @param socket - 服务器 socket 标识
   * @param createClient - 创建客户端的函数
   * @param options - 连接选项
   */
  async prewarmConnection(
    socket: string,
    createClient: (options: ChatWsConnectOptions) => ChatWsClient,
    options: ChatWsConnectOptions = {}
  ): Promise<void> {
    if (!this.config.enablePrewarming) {
      return;
    }

    if (this.pool.has(socket)) {
      logger.debug("Action: network_ws_pool_prewarm_skip_exists", { socket });
      return;
    }

    logger.info("Action: network_ws_pool_prewarm_start", { socket });

    try {
      // 以 refCount=0 预创建连接
      const client = createClient(options);
      this.addOrUpdateConnection(socket, client, 0);
      logger.info("Action: network_ws_pool_prewarm_success", { socket });
    } catch (error) {
      logger.error("Action: network_ws_pool_prewarm_failed", {
        socket,
        error: String(error),
      });
    }
  }

  /**
   * 获取连接池统计信息。
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    byStatus: Record<string, number>;
  } {
    const byStatus: Record<string, number> = {};
    let activeConnections = 0;
    let idleConnections = 0;

    for (const item of this.pool.values()) {
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
      if (item.refCount > 0) {
        activeConnections++;
      } else {
        idleConnections++;
      }
    }

    return {
      totalConnections: this.pool.size,
      activeConnections,
      idleConnections,
      byStatus,
    };
  }

  /**
   * 销毁连接池。
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.closeAllConnections();
    logger.info("Action: network_ws_pool_destroyed");
  }
}

/**
 * 全局 WebSocket 连接池实例。
 */
let globalConnectionPool: WsConnectionPool | null = null;

/**
 * 获取全局 WebSocket 连接池实例。
 *
 * @param config - 可选配置（仅首次调用时生效）
 */
export function getWsConnectionPool(config?: Partial<ConnectionPoolConfig>): WsConnectionPool {
  if (!globalConnectionPool) {
    globalConnectionPool = new WsConnectionPool(config);
  }
  return globalConnectionPool;
}

/**
 * 销毁全局 WebSocket 连接池实例。
 */
export function destroyWsConnectionPool(): void {
  if (globalConnectionPool) {
    globalConnectionPool.destroy();
    globalConnectionPool = null;
  }
}