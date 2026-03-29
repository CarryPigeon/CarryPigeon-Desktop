/**
 * @fileoverview 当前 server workspace 高层公开入口。
 * @description
 * 提供“当前 server workspace”相关的高层查询与命令，供 app/processes 与其他 feature 消费。
 *
 * 说明：
 * - 该文件是 server-connection 的首选高层公共面；
 * - 它组合 `rack + connectivity + server-info + scope-lifecycle`；
 * - 跨 feature 只暴露 plain snapshot / observer / command，不直接暴露 Vue `ref`/`computed`。
 */

import { watch } from "vue";
import { createLatestAsyncController } from "@/shared/utils/latestAsync";
import type { FailureOutcome, SemanticErrorInfo, SuccessOutcome } from "@/shared/types/semantics";
import { getConnectivityCapabilities } from "../connectivity/api";
import { getRackCapabilities, type ServerRack } from "../rack/api";
import { getScopeLifecycleCapabilities } from "../scope-lifecycle/api";
import { getServerInfoCapabilities } from "../server-info/api";
import type { ServerInfo } from "../server-info/domain/types/serverInfo";

/**
 * 当前 server workspace 发起连接时的重试参数。
 */
export type ServerWorkspaceConnectOptions = {
  maxAttempts?: number;
  maxDelayMs?: number;
  baseDelayMs?: number;
};

/**
 * 当前 server workspace 切换流程选项。
 */
export type ServerWorkspaceSwitchOptions = {
  connect?: boolean;
  refreshInfo?: boolean;
  connectOptions?: ServerWorkspaceConnectOptions;
};

/**
 * 跨 feature 可消费的当前 server workspace 快照。
 */
export type ServerWorkspaceSnapshot = {
  serverSocket: string;
  serverDirectory: readonly ServerRack[];
  connectionPhase: "idle" | "connecting" | "connected" | "failed";
  connectionDetail: string;
  connectionPillState: "connected" | "reconnecting" | "offline";
  serverInfo: ServerInfo | null;
  serverInfoLoading: boolean;
  serverInfoError: string;
  serverId: string;
};

export type ServerWorkspaceCommandErrorCode =
  | "missing_server_socket"
  | "connect_failed"
  | "retry_connect_failed"
  | "refresh_info_failed"
  | "activate_failed";

export type ServerWorkspaceCommandErrorInfo = SemanticErrorInfo<ServerWorkspaceCommandErrorCode>;

export type ServerWorkspaceConnectionOutcome =
  | SuccessOutcome<"server_connection_ready", { serverSocket: string }>
  | FailureOutcome<"server_connection_rejected", ServerWorkspaceCommandErrorCode>;

export type ServerWorkspaceInfoRefreshOutcome =
  | SuccessOutcome<"server_info_refreshed", { serverSocket: string; serverId: string }>
  | FailureOutcome<"server_info_refresh_rejected", ServerWorkspaceCommandErrorCode>;

export type ServerWorkspaceActivationOutcome =
  | SuccessOutcome<"server_workspace_activated", { serverSocket: string; connected: boolean; infoRefreshed: boolean }>
  | FailureOutcome<"server_workspace_activation_rejected", ServerWorkspaceCommandErrorCode>;

function cloneServerRack(rack: ServerRack): ServerRack {
  return {
    id: rack.id,
    name: rack.name,
    serverSocket: rack.serverSocket,
    pinned: rack.pinned,
    note: rack.note,
    tlsPolicy: rack.tlsPolicy,
    tlsFingerprint: rack.tlsFingerprint,
    notifyMode: rack.notifyMode,
  };
}

function cloneServerInfo(info: ServerInfo | null): ServerInfo | null {
  if (!info) return null;
  return {
    ...info,
    requiredPlugins: info.requiredPlugins ? [...info.requiredPlugins] : undefined,
    capabilities: info.capabilities ? { ...info.capabilities } : undefined,
  };
}

function freezeServerDirectorySnapshot(items: readonly ServerRack[]): readonly ServerRack[] {
  return Object.freeze(items.map(cloneServerRack));
}

export type ServerWorkspaceCapabilities = {
  getSnapshot(): ServerWorkspaceSnapshot;
  observeSnapshot(observer: (snapshot: ServerWorkspaceSnapshot) => void): () => void;
  readSocket(): string;
  listDirectory(): readonly ServerRack[];
  readTlsPolicy(serverSocket: string): string;
  selectSocket(serverSocket: string): void;
  activate(serverSocket: string, options?: ServerWorkspaceSwitchOptions): Promise<ServerWorkspaceActivationOutcome>;
  readInfo(): ServerInfo | null;
  connect(options?: ServerWorkspaceConnectOptions): Promise<ServerWorkspaceConnectionOutcome>;
  retryConnect(): Promise<ServerWorkspaceConnectionOutcome>;
  refreshInfo(): Promise<ServerWorkspaceInfoRefreshOutcome>;
  clearState(): Promise<void>;
};

function toServerWorkspaceCommandErrorInfo(
  code: ServerWorkspaceCommandErrorCode,
  fallback: string,
  error?: unknown,
): ServerWorkspaceCommandErrorInfo {
  return {
    code,
    message: error instanceof Error ? error.message || fallback : String(error ?? "") || fallback,
    retryable: code !== "missing_server_socket",
  };
}

/**
 * 创建 workspace 子域能力对象。
 */
export function createServerWorkspaceCapabilities(): ServerWorkspaceCapabilities {
  const connectivityCapabilities = getConnectivityCapabilities();
  const rackCapabilities = getRackCapabilities();
  const scopeLifecycleCapabilities = getScopeLifecycleCapabilities();
  const serverInfoCapabilities = getServerInfoCapabilities();
  const switchCommandController = createLatestAsyncController();

  function readCurrentServerWorkspaceSocket(): string {
    return String(rackCapabilities.getCurrentSocket() ?? "").trim();
  }

  function listServerDirectory(): readonly ServerRack[] {
    return freezeServerDirectorySnapshot(rackCapabilities.listDirectory());
  }

  function readCurrentServerWorkspaceTlsPolicy(serverSocket: string): string {
    return rackCapabilities.getTlsConfig(serverSocket).tlsPolicy;
  }

  function selectCurrentServerWorkspaceSocket(serverSocket: string): void {
    rackCapabilities.selectSocket(serverSocket);
  }

  function readCurrentServerWorkspaceInfo(): ServerInfo | null {
    return cloneServerInfo(serverInfoCapabilities.getSnapshot(readCurrentServerWorkspaceSocket()));
  }

  async function connectCurrentServerWorkspace(
    options?: ServerWorkspaceConnectOptions,
  ): Promise<ServerWorkspaceConnectionOutcome> {
    const socket = readCurrentServerWorkspaceSocket();
    if (!socket) {
      return {
        ok: false,
        kind: "server_connection_rejected",
        error: toServerWorkspaceCommandErrorInfo("missing_server_socket", "Missing server socket."),
      };
    }
    try {
      await connectivityCapabilities.connectWithRetry(socket, options);
      return {
        ok: true,
        kind: "server_connection_ready",
        serverSocket: socket,
      };
    } catch (error) {
      return {
        ok: false,
        kind: "server_connection_rejected",
        error: toServerWorkspaceCommandErrorInfo("connect_failed", "Connect failed.", error),
      };
    }
  }

  async function retryCurrentServerWorkspace(): Promise<ServerWorkspaceConnectionOutcome> {
    const socket = readCurrentServerWorkspaceSocket();
    if (!socket) {
      return {
        ok: false,
        kind: "server_connection_rejected",
        error: toServerWorkspaceCommandErrorInfo("missing_server_socket", "Missing server socket."),
      };
    }
    try {
      await connectivityCapabilities.retry();
      return {
        ok: true,
        kind: "server_connection_ready",
        serverSocket: socket,
      };
    } catch (error) {
      return {
        ok: false,
        kind: "server_connection_rejected",
        error: toServerWorkspaceCommandErrorInfo("retry_connect_failed", "Retry connect failed.", error),
      };
    }
  }

  async function refreshCurrentServerWorkspaceInfo(): Promise<ServerWorkspaceInfoRefreshOutcome> {
    const socket = readCurrentServerWorkspaceSocket();
    if (!socket) {
      return {
        ok: false,
        kind: "server_info_refresh_rejected",
        error: toServerWorkspaceCommandErrorInfo("missing_server_socket", "Missing server socket."),
      };
    }
    try {
      await serverInfoCapabilities.refresh(socket);
      return {
        ok: true,
        kind: "server_info_refreshed",
        serverSocket: socket,
        serverId: serverInfoCapabilities.getSnapshot(socket)?.serverId ?? "",
      };
    } catch (error) {
      return {
        ok: false,
        kind: "server_info_refresh_rejected",
        error: toServerWorkspaceCommandErrorInfo("refresh_info_failed", "Refresh server info failed.", error),
      };
    }
  }

  async function activateCurrentServerWorkspace(
    serverSocket: string,
    options?: ServerWorkspaceSwitchOptions,
  ): Promise<ServerWorkspaceActivationOutcome> {
    const socket = String(serverSocket ?? "").trim();
    const token = switchCommandController.begin();

    selectCurrentServerWorkspaceSocket(socket);
    if (!socket) {
      return {
        ok: false,
        kind: "server_workspace_activation_rejected",
        error: toServerWorkspaceCommandErrorInfo("missing_server_socket", "Missing server socket."),
      };
    }

    try {
      const shouldConnect = options?.connect !== false;
      const shouldRefreshInfo = options?.refreshInfo !== false;

      if (shouldConnect) {
        await connectivityCapabilities.connectWithRetry(socket, options?.connectOptions);
        if (!switchCommandController.isCurrent(token)) {
          return {
            ok: true,
            kind: "server_workspace_activated",
            serverSocket: socket,
            connected: true,
            infoRefreshed: false,
          };
        }
      }

      if (shouldRefreshInfo) {
        await serverInfoCapabilities.refresh(socket);
        if (!switchCommandController.isCurrent(token)) {
          return {
            ok: true,
            kind: "server_workspace_activated",
            serverSocket: socket,
            connected: shouldConnect,
            infoRefreshed: true,
          };
        }
      }

      return {
        ok: true,
        kind: "server_workspace_activated",
        serverSocket: socket,
        connected: shouldConnect,
        infoRefreshed: shouldRefreshInfo,
      };
    } catch (error) {
      return {
        ok: false,
        kind: "server_workspace_activation_rejected",
        error: toServerWorkspaceCommandErrorInfo("activate_failed", "Activate server workspace failed.", error),
      };
    }
  }

  async function clearCurrentServerWorkspaceState(): Promise<void> {
    const socket = readCurrentServerWorkspaceSocket();
    if (!socket) return;
    await scopeLifecycleCapabilities.clearCurrentWorkspace(socket);
  }

  function readCurrentServerWorkspaceSnapshot(): ServerWorkspaceSnapshot {
    const serverSocket = readCurrentServerWorkspaceSocket();
    const connection = connectivityCapabilities.getSnapshot();
    const serverInfo = cloneServerInfo(serverInfoCapabilities.getSnapshot(serverSocket));
    return {
      serverSocket,
      serverDirectory: listServerDirectory(),
      connectionPhase: connection.phase,
      connectionDetail: connection.detail,
      connectionPillState: connection.pillState,
      serverInfo,
      serverInfoLoading: serverInfoCapabilities.getLoading(serverSocket),
      serverInfoError: serverInfoCapabilities.getError(serverSocket),
      serverId: serverInfo?.serverId ?? "",
    };
  }

  function observeCurrentServerWorkspaceSnapshot(
    observer: (snapshot: ServerWorkspaceSnapshot) => void,
  ): () => void {
    return watch(readCurrentServerWorkspaceSnapshot, (snapshot) => {
      observer(snapshot);
    }, { immediate: true });
  }

  return {
    getSnapshot: readCurrentServerWorkspaceSnapshot,
    observeSnapshot: observeCurrentServerWorkspaceSnapshot,
    readSocket: readCurrentServerWorkspaceSocket,
    listDirectory: listServerDirectory,
    readTlsPolicy: readCurrentServerWorkspaceTlsPolicy,
    selectSocket: selectCurrentServerWorkspaceSocket,
    activate: activateCurrentServerWorkspace,
    readInfo: readCurrentServerWorkspaceInfo,
    connect: connectCurrentServerWorkspace,
    retryConnect: retryCurrentServerWorkspace,
    refreshInfo: refreshCurrentServerWorkspaceInfo,
    clearState: clearCurrentServerWorkspaceState,
  };
}

let serverWorkspaceCapabilitiesSingleton: ServerWorkspaceCapabilities | null = null;

/**
 * 获取 workspace 子域共享能力对象。
 */
export function getServerWorkspaceCapabilities(): ServerWorkspaceCapabilities {
  serverWorkspaceCapabilitiesSingleton ??= createServerWorkspaceCapabilities();
  return serverWorkspaceCapabilitiesSingleton;
}
