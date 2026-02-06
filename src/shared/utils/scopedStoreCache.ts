/**
 * @fileoverview scopedStoreCache.ts
 * @description 通用缓存工具：按 server socket 维度缓存 store 单例。
 *
 * 背景：
 * - 展示层（Vue store）常以“server socket”为作用域做单例缓存；
 * - 该模式在多个 store 内重复实现：normalize key → map.get → create → map.set；
 * - 统一抽取有助于减少样板代码，并让缓存规则在一个地方保持一致。
 */

import { normalizeServerKey } from "@/shared/serverKey";

/**
 * per-server store 工厂上下文。
 */
export type ServerScopedStoreFactoryContext = {
  /**
   * 归一化后的 server key（通过 `normalizeServerKey(serverSocket)` 得到）。
   */
  key: string;
  /**
   * 调用方传入的原始 server socket（未归一化）。
   */
  serverSocket: string;
};

/**
 * 获取（或创建）per-server 的 store 单例。
 *
 * @template T - store 类型。
 * @param stores - 缓存 map（key 为 `normalizeServerKey(serverSocket)`）。
 * @param serverSocket - 当前 server socket（允许为空，空值会被归一化为 `NO_SERVER_KEY`）。
 * @param factory - 当缓存未命中时用于创建 store 的工厂函数。
 * @returns 稳定的 store 实例。
 */
export function getOrCreateServerScopedStore<T>(
  stores: Map<string, T>,
  serverSocket: string,
  factory: (ctx: ServerScopedStoreFactoryContext) => T,
): T {
  const key = normalizeServerKey(serverSocket);
  const existing = stores.get(key);
  if (existing) return existing;

  const store = factory({ key, serverSocket });
  stores.set(key, store);
  return store;
}

