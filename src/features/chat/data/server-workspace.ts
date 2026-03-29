/**
 * @fileoverview chat/serverWorkspace integration
 * @description
 * 为 chat feature 提供统一的服务器工作区访问入口，避免各子模块直接依赖 server-connection feature。
 */

import { computed, type ComputedRef, type Ref } from "vue";
import { getServerConnectionCapabilities } from "@/features/server-connection/api";
import type {
  ServerWorkspaceActivationOutcome,
  ServerWorkspaceConnectionOutcome,
  ServerWorkspaceInfoRefreshOutcome,
  ServerWorkspaceSwitchOptions,
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

type ChatServerWorkspace = {
  socket: ComputedRef<string>;
  serverInfoStore: ComputedRef<ServerInfoStoreView>;
  serverId: ComputedRef<string>;
  refreshServerInfo(): Promise<ServerWorkspaceInfoRefreshOutcome>;
};

const chatServerWorkspaceState: Ref<ServerWorkspaceSnapshot> = createCapabilitySnapshotRef(
  serverConnectionCapabilities.workspace,
);

function getChatServerWorkspaceState(): Ref<ServerWorkspaceSnapshot> {
  return chatServerWorkspaceState;
}

export const chatCurrentServerSocket = computed(() => getChatServerWorkspaceState().value.serverSocket);
export const chatServerRacks = computed(() => getChatServerWorkspaceState().value.serverDirectory);
export const chatConnectionDetail = computed(() => getChatServerWorkspaceState().value.connectionDetail);
export const chatConnectionPillState = computed(() => getChatServerWorkspaceState().value.connectionPillState);
export const chatConnectionPhase = computed(() => getChatServerWorkspaceState().value.connectionPhase);
export const retryChatConnection = (): Promise<ServerWorkspaceConnectionOutcome> =>
  serverConnectionCapabilities.workspace.retryConnect();

const chatServerInfo = computed(() => getChatServerWorkspaceState().value.serverInfo);
const chatServerInfoLoading = computed(() => getChatServerWorkspaceState().value.serverInfoLoading);
const chatServerInfoError = computed(() => getChatServerWorkspaceState().value.serverInfoError);
const chatServerId = computed(() => getChatServerWorkspaceState().value.serverId);
const chatServerInfoStore = computed<ServerInfoStoreView>(() => ({
  info: chatServerInfo,
  loading: chatServerInfoLoading,
  error: chatServerInfoError,
  refresh: () => serverConnectionCapabilities.workspace.refreshInfo(),
}));

export function useChatServerWorkspace(): ChatServerWorkspace {
  return {
    socket: chatCurrentServerSocket,
    serverInfoStore: chatServerInfoStore,
    serverId: chatServerId,
    refreshServerInfo: () => serverConnectionCapabilities.workspace.refreshInfo(),
  };
}

export function getActiveChatServerSocket(): string {
  return serverConnectionCapabilities.workspace.readSocket();
}

export function selectActiveChatServer(serverSocket: string): void {
  serverConnectionCapabilities.workspace.selectSocket(serverSocket);
}

export function connectChatServer(serverSocket: string): Promise<ServerWorkspaceActivationOutcome> {
  return serverConnectionCapabilities.workspace.activate(serverSocket, {
    connect: true,
    refreshInfo: false,
  });
}

export function switchChatServerWorkspace(
  serverSocket: string,
  options?: ServerWorkspaceSwitchOptions,
): Promise<ServerWorkspaceActivationOutcome> {
  return serverConnectionCapabilities.workspace.activate(serverSocket, options);
}

export function getChatTlsPolicy(serverSocket: string) {
  return serverConnectionCapabilities.workspace.readTlsPolicy(serverSocket);
}

export function getChatWsUrlOverride(serverSocket: string): string | undefined {
  const info =
    serverSocket === serverConnectionCapabilities.workspace.readSocket()
      ? serverConnectionCapabilities.workspace.readInfo()
      : null;
  return String(info?.wsUrl ?? "").trim() || undefined;
}
