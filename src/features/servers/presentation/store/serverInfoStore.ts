/**
 * @fileoverview serverInfoStore.ts
 * @description servers｜展示层状态（store）：serverInfoStore。
 *
 * PRD：
 * - `server_id` 用于插件隔离（见 `design/protocol/PROTOCOL-OVERVIEW.md`）。
 * - 若 `server_id` 缺失，则必须禁用插件安装/启用/更新，并在 UI 给出原因提示。
 */

import { computed, ref, type Ref } from "vue";
import type { ServerInfo } from "@/features/servers/domain/types/serverInfo";
import { getGetServerInfoUsecase } from "@/features/servers/di/servers.di";
import { currentServerSocket } from "./currentServer";
import { createLogger } from "@/shared/utils/logger";
import { getOrCreateServerScopedStore } from "@/shared/utils/scopedStoreCache";

type ServerInfoStore = {
  info: Ref<ServerInfo | null>;
  loading: Ref<boolean>;
  error: Ref<string>;
  refresh(): Promise<void>;
};

const logger = createLogger("serverInfoStore");
const stores = new Map<string, ServerInfoStore>();

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
        logger.error("Action: refresh_server_info_failed", { socket, error: String(e) });
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

/**
 * 基于 `currentServerSocket` 推导当前 server info store。
 *
 * @returns 当前 socket 对应的 store 实例。
 */
function computeCurrentServerInfoStore(): ServerInfoStore {
  return useServerInfoStore(currentServerSocket.value);
}

/**
 * 当前 server info store（由 `currentServerSocket` 推导）。
 *
 * @constant
 */
export const currentServerInfoStore = computed(computeCurrentServerInfoStore);

/**
 * 便捷 ref：当前 server info。
 *
 * @returns 当前 server info；不存在时为 `null`。
 */
function computeCurrentServerInfo(): ServerInfo | null {
  return currentServerInfoStore.value.info.value;
}

/**
 * 便捷 ref：当前 server info。
 *
 * @constant
 */
export const currentServerInfo = computed(computeCurrentServerInfo);

/**
 * 便捷 ref：当前稳定 `server_id`。
 *
 * 说明：
 * - 空字符串表示当前服务端缺失/不可用 `server_id`。
 *
 * @returns server_id 字符串（缺失时为空）。
 */
function computeCurrentServerId(): string {
  return currentServerInfo.value?.serverId ?? "";
}

/**
 * 便捷 ref：当前稳定 `server_id`。
 *
 * @constant
 */
export const currentServerId = computed(computeCurrentServerId);
