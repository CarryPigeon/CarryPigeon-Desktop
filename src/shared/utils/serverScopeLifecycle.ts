/**
 * @fileoverview serverScopeLifecycle.ts
 * @description server scope 生命周期治理：用于在切服/登出时清理按 server 缓存的状态。
 */

import { normalizeServerKey } from "@/shared/serverKey";
import { createLogger } from "@/shared/utils/logger";

export type ServerScopeCleanupEvent =
  | { type: "scope"; key: string }
  | { type: "all" };

export type ServerScopeCleanupHandler = (event: ServerScopeCleanupEvent) => void | Promise<void>;

const logger = createLogger("serverScopeLifecycle");
const handlers = new Set<ServerScopeCleanupHandler>();

/**
 * 注册 server scope 清理回调。
 *
 * @param handler - 清理处理函数。
 * @returns 取消注册函数。
 */
export function registerServerScopeCleanupHandler(handler: ServerScopeCleanupHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/**
 * 清理指定 server scope 的缓存状态。
 *
 * @param serverSocket - server socket。
 */
export function cleanupServerScope(serverSocket: string): void {
  const key = normalizeServerKey(serverSocket);
  if (!key) return;
  void runCleanup({ type: "scope", key });
}

/**
 * 清理全部 server scope 缓存状态（通常用于登出/断开所有上下文）。
 */
export function cleanupAllServerScopes(): void {
  void runCleanup({ type: "all" });
}

async function runCleanup(event: ServerScopeCleanupEvent): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const handler of handlers) {
    tasks.push(
      Promise.resolve(handler(event)).catch((error) => {
        logger.warn("Action: servers_scope_cleanup_handler_failed", {
          eventType: event.type,
          key: event.type === "scope" ? event.key : "",
          error: String(error),
        });
      }),
    );
  }
  await Promise.all(tasks);
}
