/**
 * @fileoverview 异步去重工具（按 key 复用 in-flight Promise）。
 * @description 通用工具：asyncDedupe。
 * 用于将“同一语义”的并发异步任务合并为一次执行：
 * - 多个调用方同时触发 refresh/list 等操作时，避免重复网络请求
 * - 保证任务完成后自动清理缓存，避免内存泄漏
 *
 * 注意：
 * - 该工具只去重“并发中的同一 key”；任务完成后再次调用仍会重新执行。
 * - key 的粒度由调用方决定（例如 `serverInfo:socket` / `catalog:socket`）。
 */

const inFlight = new Map<string, Promise<unknown>>();

/**
 * 按 key 去重异步任务：同一 key 在执行中的调用会复用同一个 Promise。
 *
 * @param key - 去重 key（建议包含业务维度，例如 `catalog:${socket}`）。
 * @param fn - 实际执行函数。
 * @returns 任务 Promise（可被多个调用方共享）。
 */
export function dedupeAsyncByKey<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const k = String(key ?? "").trim();
  if (!k) return fn();

  const existing = inFlight.get(k) as Promise<T> | undefined;
  if (existing) return existing;

  const p = fn().finally(() => {
    if (inFlight.get(k) === p) inFlight.delete(k);
  });
  inFlight.set(k, p as Promise<unknown>);
  return p;
}

