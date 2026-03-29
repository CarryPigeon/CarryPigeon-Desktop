/**
 * @fileoverview plugins/serverWorkspace integration
 * @description
 * 为 plugins feature 提供本地响应式 server workspace 视图，避免页面直接依赖 server-connection 根公开面的快照协议。
 */

import { computed, type ComputedRef, type Ref } from "vue";
import { getServerConnectionCapabilities } from "@/features/server-connection/api";
import type { ServerWorkspaceInfoRefreshOutcome } from "@/features/server-connection/api-types";
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

type PluginsServerWorkspace = {
  socket: ComputedRef<string>;
  serverInfoStore: ComputedRef<ServerInfoStoreView>;
  serverId: ComputedRef<string>;
  refreshServerInfo(): Promise<ServerWorkspaceInfoRefreshOutcome>;
};

const pluginsServerWorkspaceState: Ref<ServerWorkspaceSnapshot> = createCapabilitySnapshotRef(
  serverConnectionCapabilities.workspace,
);

function getPluginsServerWorkspaceState(): Ref<ServerWorkspaceSnapshot> {
  return pluginsServerWorkspaceState;
}

const pluginsServerSocket = computed(() => getPluginsServerWorkspaceState().value.serverSocket);
const pluginsServerInfo = computed(() => getPluginsServerWorkspaceState().value.serverInfo);
const pluginsServerInfoLoading = computed(() => getPluginsServerWorkspaceState().value.serverInfoLoading);
const pluginsServerInfoError = computed(() => getPluginsServerWorkspaceState().value.serverInfoError);
const pluginsServerId = computed(() => getPluginsServerWorkspaceState().value.serverId);
const pluginsServerInfoStore = computed<ServerInfoStoreView>(() => ({
  info: pluginsServerInfo,
  loading: pluginsServerInfoLoading,
  error: pluginsServerInfoError,
  refresh: () => serverConnectionCapabilities.workspace.refreshInfo(),
}));

export function usePluginsServerWorkspace(): PluginsServerWorkspace {
  return {
    socket: pluginsServerSocket,
    serverInfoStore: pluginsServerInfoStore,
    serverId: pluginsServerId,
    refreshServerInfo: () => serverConnectionCapabilities.workspace.refreshInfo(),
  };
}
