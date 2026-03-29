/**
 * @fileoverview account/auth-flow serverWorkspace integration
 * @description
 * 为 auth-flow 提供本地响应式 server workspace 视图，避免页面直接依赖 server-connection 根公开面的快照协议。
 */

import { computed, type ComputedRef, type Ref } from "vue";
import { getServerConnectionCapabilities } from "@/features/server-connection/api";
import type {
  ServerWorkspaceConnectOptions,
  ServerWorkspaceConnectionOutcome,
  ServerWorkspaceInfoRefreshOutcome,
} from "@/features/server-connection/api-types";
import { createCapabilitySnapshotRef } from "@/shared/utils/createCapabilitySnapshotRef";

const serverConnectionCapabilities = getServerConnectionCapabilities();
type ServerConnectionCapabilities = ReturnType<typeof getServerConnectionCapabilities>;
type ServerWorkspaceSnapshot = ReturnType<ServerConnectionCapabilities["workspace"]["getSnapshot"]>;
type ServerInfo = ReturnType<ServerConnectionCapabilities["workspace"]["readInfo"]>;

type ServerInfoStoreView = {
  info: ComputedRef<ServerInfo | null>;
  loading: ComputedRef<boolean>;
  error: ComputedRef<string>;
  refresh(): Promise<ServerWorkspaceInfoRefreshOutcome>;
};

type AuthServerWorkspace = {
  socket: ComputedRef<string>;
  serverDirectory: ComputedRef<ServerWorkspaceSnapshot["serverDirectory"]>;
  connectionPhase: ComputedRef<ServerWorkspaceSnapshot["connectionPhase"]>;
  connectionDetail: ComputedRef<string>;
  connectionPillState: ComputedRef<ServerWorkspaceSnapshot["connectionPillState"]>;
  serverInfoStore: ComputedRef<ServerInfoStoreView>;
  serverId: ComputedRef<string>;
  refreshServerInfo(): Promise<ServerWorkspaceInfoRefreshOutcome>;
};

const authServerWorkspaceState: Ref<ServerWorkspaceSnapshot> = createCapabilitySnapshotRef(
  serverConnectionCapabilities.workspace,
);

function getAuthServerWorkspaceState() {
  return authServerWorkspaceState;
}

const authServerSocket = computed(() => getAuthServerWorkspaceState().value.serverSocket);
const authServerDirectory = computed(() => getAuthServerWorkspaceState().value.serverDirectory);
const authConnectionPhase = computed(() => getAuthServerWorkspaceState().value.connectionPhase);
const authConnectionDetail = computed(() => getAuthServerWorkspaceState().value.connectionDetail);
const authConnectionPillState = computed(() => getAuthServerWorkspaceState().value.connectionPillState);
const authServerInfo = computed(() => getAuthServerWorkspaceState().value.serverInfo);
const authServerInfoLoading = computed(() => getAuthServerWorkspaceState().value.serverInfoLoading);
const authServerInfoError = computed(() => getAuthServerWorkspaceState().value.serverInfoError);
const authServerId = computed(() => getAuthServerWorkspaceState().value.serverId);
const authServerInfoStore = computed<ServerInfoStoreView>(() => ({
  info: authServerInfo,
  loading: authServerInfoLoading,
  error: authServerInfoError,
  refresh: () => serverConnectionCapabilities.workspace.refreshInfo(),
}));

export function useAuthServerWorkspace(): AuthServerWorkspace {
  return {
    socket: authServerSocket,
    serverDirectory: authServerDirectory,
    connectionPhase: authConnectionPhase,
    connectionDetail: authConnectionDetail,
    connectionPillState: authConnectionPillState,
    serverInfoStore: authServerInfoStore,
    serverId: authServerId,
    refreshServerInfo: () => serverConnectionCapabilities.workspace.refreshInfo(),
  };
}

export {
  authConnectionDetail,
  authConnectionPhase,
  authConnectionPillState,
  authServerDirectory,
  authServerSocket,
};

export function addAuthServerRack(serverSocket: string, name: string): void {
  serverConnectionCapabilities.rack.addServer(serverSocket, name);
}

export function connectAuthServerWorkspace(options?: ServerWorkspaceConnectOptions): Promise<ServerWorkspaceConnectionOutcome> {
  return serverConnectionCapabilities.workspace.connect(options);
}

export function retryAuthServerWorkspace(): Promise<ServerWorkspaceConnectionOutcome> {
  return serverConnectionCapabilities.workspace.retryConnect();
}

export function selectAuthServerWorkspace(serverSocket: string): void {
  serverConnectionCapabilities.workspace.selectSocket(serverSocket);
}
