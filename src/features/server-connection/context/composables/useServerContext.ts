/**
 * @fileoverview 服务器上下文组合式函数（server socket + server-info）。
 * @description server-connection/context｜模块：useServerContext。
 * 用于在页面/组件中复用“当前 server socket 与 server-info 视图模型”的解析逻辑，并提供
 * 去重后的 refresh 方法。
 */

import { computed, type ComputedRef, type Ref } from "vue";
import { getServerConnectionCapabilities } from "@/features/server-connection/api";
import type { ServerInfo, ServerWorkspaceInfoRefreshOutcome } from "@/features/server-connection/api-types";
import { createCapabilitySnapshotRef } from "@/shared/utils/createCapabilitySnapshotRef";
import { dedupeAsyncByKey } from "@/shared/utils/asyncDedupe";

const serverConnectionCapabilities = getServerConnectionCapabilities();
const serverWorkspaceState = createCapabilitySnapshotRef(serverConnectionCapabilities.workspace);

/**
 * server-info 只读视图模型。
 */
export type ServerInfoStoreView = {
  info: ComputedRef<ServerInfo | null>;
  loading: ComputedRef<boolean>;
  error: ComputedRef<string>;
  refresh(): Promise<ServerWorkspaceInfoRefreshOutcome>;
};

/**
 * 服务器上下文：当前 socket + server-info 组合体。
 */
export type ServerContext = {
  /**
   * 当前 server socket（已 trim）。
   */
  socket: ComputedRef<string>;
  /**
   * 当前 socket 对应的 server-info 只读视图。
   */
  serverInfoStore: ComputedRef<ServerInfoStoreView>;
  /**
   * 当前稳定 server_id（缺失时为空字符串）。
   */
  serverId: ComputedRef<string>;
  /**
   * 去重后的 server-info 刷新（同一 socket 并发只刷新一次）。
   */
  refreshServerInfo(): Promise<ServerWorkspaceInfoRefreshOutcome>;
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
  const socket = computed(() => serverWorkspaceState.value.serverSocket);
  const info = computed(() => serverWorkspaceState.value.serverInfo);
  const loading = computed(() => serverWorkspaceState.value.serverInfoLoading);
  const error = computed(() => serverWorkspaceState.value.serverInfoError);

  /**
   * 刷新当前 socket 对应的 server-info，并对并发请求做去重。
   *
   * @returns 无返回值。
   */
  async function refreshCurrentServerInfo(): Promise<ServerWorkspaceInfoRefreshOutcome> {
    const s = socket.value;
    if (!s) {
      return {
        ok: false,
        kind: "server_info_refresh_rejected",
        error: {
          code: "missing_server_socket",
          message: "Missing server socket.",
          retryable: false,
        },
      };
    }
    return dedupeAsyncByKey(`serverInfo:refresh:${s}`, () => serverConnectionCapabilities.workspace.refreshInfo());
  }

  const serverInfoStore = computed<ServerInfoStoreView>(() => ({
    info,
    loading,
    error,
    refresh: refreshCurrentServerInfo,
  }));

  const serverId = computed(() => info.value?.serverId ?? "");

  return { socket, serverInfoStore, serverId, refreshServerInfo: refreshCurrentServerInfo };
}
