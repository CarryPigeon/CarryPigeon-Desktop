/**
 * @fileoverview refreshDedupe.ts
 * @description plugins｜composables 内部工具：按 server socket 对异步刷新做并发去重。
 */

import { dedupeAsyncByKey } from "@/shared/utils/asyncDedupe";

/**
 * 按 socket 作用域去重一次刷新任务。
 *
 * @param scope - 去重 key 前缀（例如 `pluginCatalog:refresh`）。
 * @param socket - server socket。
 * @param task - 实际刷新任务。
 */
export async function dedupeRefreshBySocket(
  scope: string,
  socket: string,
  task: () => Promise<void>,
): Promise<void> {
  const normalizedSocket = String(socket ?? "").trim();
  if (!normalizedSocket) return;
  await dedupeAsyncByKey(`${scope}:${normalizedSocket}`, task);
}
