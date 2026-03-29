/**
 * @fileoverview currentServerWorkspaceCleanupHandlers
 * @description
 * server-connection/scope-lifecycle｜应用层扩展点：注册清理当前 server workspace 后的跨 feature 收尾动作。
 */

export type CurrentServerWorkspaceCleanupHandler = () => Promise<void> | void;

const cleanupHandlers = new Set<CurrentServerWorkspaceCleanupHandler>();

/**
 * 注册“当前 server workspace 清理完成后”的附加收尾动作。
 *
 * 说明：
 * - 该扩展点用于 app/composition root 注入跨 feature 清理；
 * - `server-connection` 本身不应静态依赖其它 feature 的内存状态。
 */
export function registerCurrentServerWorkspaceCleanupHandler(
  handler: CurrentServerWorkspaceCleanupHandler,
): () => void {
  cleanupHandlers.add(handler);
  return () => {
    cleanupHandlers.delete(handler);
  };
}

/**
 * 依次执行已注册的清理收尾动作。
 */
export async function runCurrentServerWorkspaceCleanupHandlers(): Promise<void> {
  for (const handler of cleanupHandlers) {
    await handler();
  }
}
