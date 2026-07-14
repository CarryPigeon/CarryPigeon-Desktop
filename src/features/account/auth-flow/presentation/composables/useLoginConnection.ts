/**
 * @fileoverview useLoginConnection.ts
 * @description account/auth-flow｜页面编排：连接阶段（socket 同步 + 握手 + server info）。
 */

import { computed, onMounted, ref, watch, type ComputedRef, type Ref } from "vue";
import {
  addAuthServerRack,
  authConnectionPhase,
  authServerDirectory,
  authServerSocket,
  connectAuthServerWorkspace,
  selectAuthServerWorkspace,
  updateAuthServerRackName,
  useAuthServerWorkspace,
} from "@/features/account/auth-flow/integration/serverWorkspace";
import type { ServerInfo } from "@/features/server-connection/api-types";
import { createLogger } from "@/shared/utils/logger";

export type TransportKind = "tls_strict" | "tls_insecure" | "tcp_legacy";

export type UseLoginConnectionDeps = {
  onSocketDraftChanged?: () => void;
};

export type LoginConnectionModel = {
  transport: Ref<TransportKind>;
  socketDraft: Ref<string>;
  stage: ComputedRef<"Handshake" | "Auth">;
  serverInfo: ComputedRef<ServerInfo | null>;
  syncServerSocket(): void;
  handleConnect(): Promise<void>;
};

const logger = createLogger("LoginPage");

/**
 * 登录连接模型（连接阶段）。
 *
 * @param deps - 可选回调（socket draft 改变时触发）。
 * @returns 页面可直接绑定的连接状态与动作。
 */
export function useLoginConnection(deps: UseLoginConnectionDeps = {}): LoginConnectionModel {
  const { serverInfoStore, refreshServerInfo } = useAuthServerWorkspace();
  /**
   * 连接方式选择（当前主要用于 UI 展示，尚未映射到底层连接参数）。
   * 若后续接入真实切换，应在 `handleConnect` 中透传到连接层。
   */
  const transport = ref<TransportKind>("tls_strict");
  const socketDraft = ref(authServerSocket.value);

  const stage = computed<"Handshake" | "Auth">(() => {
    if (authConnectionPhase.value === "connected") return "Auth";
    return "Handshake";
  });

  const serverInfo = computed(() => serverInfoStore.value.info.value);

  function syncServerSocket(): void {
    selectAuthServerWorkspace(socketDraft.value.trim());
  }

  async function handleConnect(): Promise<void> {
    syncServerSocket();
    const socket = authServerSocket.value.trim();
    await connectAuthServerWorkspace({ maxAttempts: 6 });
    if (authConnectionPhase.value === "connected") {
      await refreshServerInfo();
      // 检查 refresh 是否成功获取到 server info
      if (serverInfo.value) {
        syncRackNameFromServerInfo(socket);
        logger.info("Action: servers_info_refreshed", { socket, serverId: serverInfo.value.serverId ?? "" });
      } else {
        logger.warn("Action: servers_info_refresh_failed_after_connect", { socket });
      }
    }
  }

  /**
   * 将当前 rack 的展示名同步为拉取到的真实服务器名。
   *
   * 说明：
   * - 若该 socket 尚无 rack，则新增一个以服务器名为名的 rack。
   * - 若已有 rack 且名称为占位名（"Default"/"Unnamed Rack"/空），则重命名为真实服务器名。
   * - 其他情况保留用户自定义名称，避免覆盖。
   */
  function syncRackNameFromServerInfo(socket: string): void {
    const serverName = serverInfo.value?.name?.trim();
    if (!socket || !serverName) return;

    const placeholderNames = new Set(["Default", "Unnamed Rack", ""]);
    const existing = authServerDirectory.value.find((r) => r.serverSocket === socket);
    if (existing && placeholderNames.has(existing.name)) {
      updateAuthServerRackName(socket, serverName);
    } else if (!existing) {
      addAuthServerRack(socket, serverName);
    }
  }

  async function handleInitialConnect(): Promise<void> {
    try {
      await handleConnect();
    } catch (error) {
      // 首次自动连接采用 best-effort：页面仍允许用户手动点击重试。
      logger.warn("Action: auth_login_auto_connect_failed", { error: String(error) });
    }
  }

  watch(
    () => authServerSocket.value,
    (next) => {
      socketDraft.value = next;
    },
  );

  watch(
    socketDraft,
    () => {
      deps.onSocketDraftChanged?.();
    },
  );

  onMounted(() => {
    void handleInitialConnect();
  });

  return {
    transport,
    socketDraft,
    stage,
    serverInfo,
    syncServerSocket,
    handleConnect,
  };
}
