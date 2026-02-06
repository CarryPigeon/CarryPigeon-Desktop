/**
 * @fileoverview 服务器上下文组合式函数（server socket + server-info）。
 * @description servers｜模块：useServerContext。
 * 用于在页面/组件中复用“当前 server socket 与 server-info store”的解析逻辑，并提供
 * 去重后的 refresh 方法，减少多处重复的 `computeXxxStore + store.refresh()`。
 */

import { computed, type ComputedRef, type Ref } from "vue";
import { currentServerSocket, useServerInfoStore } from "@/features/servers/presentation/store";
import { dedupeAsyncByKey } from "@/shared/utils/asyncDedupe";

/**
 * 服务器上下文：当前 socket + server-info store 组合体。
 */
export type ServerContext = {
  /**
   * 当前 server socket（已 trim）。
   */
  socket: ComputedRef<string>;
  /**
   * 当前 socket 对应的 server-info store（per-server 缓存）。
   */
  serverInfoStore: ComputedRef<ReturnType<typeof useServerInfoStore>>;
  /**
   * 当前稳定 server_id（缺失时为空字符串）。
   */
  serverId: ComputedRef<string>;
  /**
   * 去重后的 server-info 刷新（同一 socket 并发只刷新一次）。
   */
  refreshServerInfo(): Promise<void>;
};

/**
 * 将任意字符串 Ref 归一化为 trim 后的 ComputedRef。
 *
 * @param source - 字符串 ref（例如 currentServerSocket）。
 * @returns trim 后的 computed。
 */
export function useTrimmedString(source: Ref<string> | ComputedRef<string>): ComputedRef<string> {
  return computed(() => String(source.value ?? "").trim());
}

/**
 * 获取“当前服务器”的上下文（基于 `currentServerSocket`）。
 *
 * @returns `ServerContext`。
 */
export function useCurrentServerContext(): ServerContext {
  const socket = useTrimmedString(currentServerSocket);
  const serverInfoStore = computed(() => useServerInfoStore(socket.value));
  const serverId = computed(() => serverInfoStore.value.info.value?.serverId ?? "");

  /**
   * 刷新当前 socket 对应的 server-info，并对并发请求做去重。
   *
   * @returns 无返回值。
   */
  async function refreshServerInfo(): Promise<void> {
    const s = socket.value;
    if (!s) return;
    await dedupeAsyncByKey(`serverInfo:refresh:${s}`, () => serverInfoStore.value.refresh());
  }

  return { socket, serverInfoStore, serverId, refreshServerInfo };
}
