/**
 * @fileoverview serverInfoStore.ts
 * @description Presentation store: per-server `server_id` + basic server info caching.
 *
 * PRD:
 * - `server_id` is required for plugin isolation (see `design/protocol/PROTOCOL-OVERVIEW.md`).
 * - When missing, plugin install/enable/update must be disabled and UI should explain why.
 */

import { computed, ref, type Ref } from "vue";
import type { ServerInfo } from "@/features/servers/domain/types/serverInfo";
import { getGetServerInfoUsecase } from "@/features/servers/di/servers.di";
import { currentServerSocket } from "@/features/servers/presentation/store/currentServer";
import { createLogger } from "@/shared/utils/logger";

type ServerInfoStore = {
  info: Ref<ServerInfo | null>;
  loading: Ref<boolean>;
  error: Ref<string>;
  refresh(): Promise<void>;
};

const logger = createLogger("serverInfoStore");
const stores = new Map<string, ServerInfoStore>();

/**
 * Get (or create) a cached server info store for a socket.
 *
 * @param serverSocket - Server socket string.
 * @returns Store instance.
 */
export function useServerInfoStore(serverSocket: string): ServerInfoStore {
  const key = serverSocket.trim() || "__no_server__";
  const existing = stores.get(key);
  if (existing) return existing;

  const info = ref<ServerInfo | null>(null);
  const loading = ref(false);
  const error = ref("");

  /**
   * Refresh server info via domain usecase.
   *
   * @returns Promise<void>
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
      logger.error("Refresh server info failed", { socket, error: String(e) });
      info.value = null;
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  const store: ServerInfoStore = { info, loading, error, refresh };
  stores.set(key, store);
  return store;
}

/**
 * Current server info store derived from `currentServerSocket`.
 *
 * @returns Store instance for current socket.
 */
function computeCurrentServerInfoStore(): ServerInfoStore {
  return useServerInfoStore(currentServerSocket.value);
}

/**
 * Current server info store derived from `currentServerSocket`.
 *
 * @constant
 */
export const currentServerInfoStore = computed(computeCurrentServerInfoStore);

/**
 * Convenience ref: current server info.
 *
 * @returns Current server info, or `null`.
 */
function computeCurrentServerInfo(): ServerInfo | null {
  return currentServerInfoStore.value.info.value;
}

/**
 * Convenience ref: current server info.
 *
 * @constant
 */
export const currentServerInfo = computed(computeCurrentServerInfo);

/**
 * Convenience ref: current stable `server_id`.
 *
 * Empty string indicates missing/unavailable `server_id` for the current server.
 *
 * @returns server_id string (empty when missing).
 */
function computeCurrentServerId(): string {
  return currentServerInfo.value?.serverId ?? "";
}

/**
 * Convenience ref: current stable `server_id`.
 *
 * @constant
 */
export const currentServerId = computed(computeCurrentServerId);
