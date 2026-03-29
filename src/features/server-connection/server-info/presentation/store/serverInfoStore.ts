/**
 * @fileoverview serverInfoStore.ts
 * @description server-connection/server-info｜展示层状态（store）：serverInfoStore。
 *
 * PRD：
 * - `server_id` 用于插件隔离（见 `docs/design/protocol/PROTOCOL-OVERVIEW.md`）。
 * - 若 `server_id` 缺失，则必须禁用插件安装/启用/更新，并在 UI 给出原因提示。
 */

import { ref, type Ref } from "vue";
import type { ServerInfo } from "@/features/server-connection/server-info/domain/types/serverInfo";
import { getGetServerInfoUsecase } from "@/features/server-connection/server-info/di/servers.di";
import { createLogger } from "@/shared/utils/logger";
import { getOrCreateServerScopedStore } from "@/shared/utils/scopedStoreCache";
import { registerServerScopeCleanupHandler } from "@/shared/utils/serverScopeLifecycle";

export type ServerInfoStore = {
  info: Readonly<Ref<ServerInfo | null>>;
  loading: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string>>;
  refresh(): Promise<void>;
};

const logger = createLogger("serverInfoStore");
const stores = new Map<string, ServerInfoStore>();
let runtimeStarted = false;
let unregisterServerScopeCleanupHandler: (() => void) | null = null;

/**
 * 启动 server-info 运行时（幂等）。
 *
 * 说明：
 * - 显式启动，避免模块加载时注册清理副作用。
 */
export function startServerInfoRuntime(): void {
  if (runtimeStarted) return;
  runtimeStarted = true;
  unregisterServerScopeCleanupHandler = registerServerScopeCleanupHandler((event) => {
    if (event.type === "all") {
      stores.clear();
      return;
    }
    stores.delete(event.key);
  });
}

/**
 * 停止 server-info 运行时（best-effort）。
 */
export function stopServerInfoRuntime(): void {
  if (!runtimeStarted) return;
  runtimeStarted = false;
  if (unregisterServerScopeCleanupHandler) {
    unregisterServerScopeCleanupHandler();
    unregisterServerScopeCleanupHandler = null;
  }
  stores.clear();
}

/**
 * 获取（或创建）指定 socket 的缓存 server info store。
 *
 * @param serverSocket - 服务端 socket 字符串。
 * @returns store 实例。
 */
export function useServerInfoStore(serverSocket: string): ServerInfoStore {
  return getOrCreateServerScopedStore(stores, serverSocket, () => {
    const info = ref<ServerInfo | null>(null);
    const loading = ref(false);
    const error = ref("");

    /**
     * 通过领域用例刷新 server info。
     *
     * @returns Promise<void>。
     */
    async function refresh(): Promise<void> {
      const socket = serverSocket.trim();
      if (!socket) {
        info.value = null;
        error.value = "Missing server socket";
        return;
      }
      loading.value = true;
      error.value = "";
      try {
        info.value = await getGetServerInfoUsecase().execute(socket);
      } catch (e) {
        logger.error("Action: servers_info_refresh_failed", { socket, error: String(e) });
        info.value = null;
        error.value = String(e);
      } finally {
        loading.value = false;
      }
    }

    const store: ServerInfoStore = { info, loading, error, refresh };
    return store;
  });
}
