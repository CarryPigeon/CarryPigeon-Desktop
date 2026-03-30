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

/**
 * 当前 chat workspace 绑定的 server socket。
 */
export const chatCurrentServerSocket = computed(() => getChatServerWorkspaceState().value.serverSocket);
/**
 * 当前 server 目录投影。
 */
export const chatServerRacks = computed(() => getChatServerWorkspaceState().value.serverDirectory);
/**
 * 当前连接详情投影。
 */
export const chatConnectionDetail = computed(() => getChatServerWorkspaceState().value.connectionDetail);
/**
 * 当前连接 pill 状态投影。
 */
export const chatConnectionPillState = computed(() => getChatServerWorkspaceState().value.connectionPillState);
/**
 * 当前连接阶段投影。
 */
export const chatConnectionPhase = computed(() => getChatServerWorkspaceState().value.connectionPhase);
/**
 * 对当前选中 server 执行重连。
 */
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

/**
 * 获取 chat 当前绑定的 server workspace 视图。
 */
export function useChatServerWorkspace(): ChatServerWorkspace {
  return {
    socket: chatCurrentServerSocket,
    serverInfoStore: chatServerInfoStore,
    serverId: chatServerId,
    refreshServerInfo: () => serverConnectionCapabilities.workspace.refreshInfo(),
  };
}

/**
 * 读取当前 chat workspace 绑定的 server socket。
 */
export function getActiveChatServerSocket(): string {
  return serverConnectionCapabilities.workspace.readSocket();
}

/**
 * 仅切换当前选中 server，不主动发起连接。
 */
export function selectActiveChatServer(serverSocket: string): void {
  serverConnectionCapabilities.workspace.selectSocket(serverSocket);
}

/**
 * 激活某个 server 并立即尝试建立连接。
 */
export function connectChatServer(serverSocket: string): Promise<ServerWorkspaceActivationOutcome> {
  return serverConnectionCapabilities.workspace.activate(serverSocket, {
    connect: true,
    refreshInfo: false,
  });
}

/**
 * 切换 chat workspace 到某个 server。
 *
 * 这是 chat feature 切服的主入口，是否立即连接、是否刷新信息由 `options` 决定。
 */
export function switchChatServerWorkspace(
  serverSocket: string,
  options?: ServerWorkspaceSwitchOptions,
): Promise<ServerWorkspaceActivationOutcome> {
  return serverConnectionCapabilities.workspace.activate(serverSocket, options);
}

/**
 * 读取某个 server 的 TLS 策略。
 */
export function getChatTlsPolicy(serverSocket: string) {
  return serverConnectionCapabilities.workspace.readTlsPolicy(serverSocket);
}

/**
 * 读取当前 server 提供的 WS URL 覆盖值。
 *
 * 只有在该 server 已经是当前激活 server 时，才会返回可用信息。
 */
export function getChatWsUrlOverride(serverSocket: string): string | undefined {
  const info =
    serverSocket === serverConnectionCapabilities.workspace.readSocket()
      ? serverConnectionCapabilities.workspace.readInfo()
      : null;
  return String(info?.wsUrl ?? "").trim() || undefined;
}
