/**
 * @fileoverview patchbay workspace model
 * @description
 * 收敛 Patchbay 主页面依赖的 server workspace、plugin gate、domain registry 与工作区切换动作。
 */

import { computed, watch, type ComputedRef, type Ref } from "vue";
import type { ComposerSubmitPayload, SendChatMessageOutcome } from "@/features/chat/message-flow/contracts";
import type { ServerWorkspaceActivationOutcome } from "@/features/server-connection/api-types";
import {
  chatServerRacks,
  switchChatServerWorkspace,
  useChatServerWorkspace,
} from "@/features/chat/integration/serverWorkspace";
import { createChatPluginAccess } from "@/features/chat/integration/pluginAccess";
import {
  ensureChatPluginRuntimeLoaded,
  getChatDomainRegistryView,
  refreshChatDomainCatalog,
} from "@/features/chat/integration/pluginRuntime";
import { createChatWorkspaceCoordinator } from "@/features/chat/application/createChatWorkspaceCoordinator";
import { usePluginHostBridge } from "./usePluginHostBridge";

type RefLike<T> = Ref<T> | ComputedRef<T>;

export type UsePatchbayWorkspaceDeps = {
  currentChannelId: RefLike<string>;
  sendComposerMessage(payload: ComposerSubmitPayload): Promise<SendChatMessageOutcome>;
  ensureChatReady(): Promise<void>;
  onAsyncError(action: string, error: unknown): void;
};

export type PatchbayWorkspaceModel = {
  socket: ComputedRef<string>;
  serverId: ComputedRef<string>;
  serverRacks: typeof chatServerRacks;
  missingRequiredCount: ComputedRef<number>;
  quickSwitcherPlugins: ComputedRef<readonly { pluginId: string; name: string }[]>;
  domainRegistryView: ComputedRef<ReturnType<typeof getChatDomainRegistryView>>;
  handleSwitchServer(serverSocket: string): void;
  bootstrapCurrentWorkspace(): Promise<void>;
  disposeWorkspace(): void;
};

/**
 * 构建 Patchbay 主页面工作区模型。
 */
export function usePatchbayWorkspace(deps: UsePatchbayWorkspaceDeps): PatchbayWorkspaceModel {
  const { socket, serverInfoStore, serverId } = useChatServerWorkspace();
  const requiredPluginsDeclared = computed(() => serverInfoStore.value.info.value?.requiredPlugins ?? null);
  const pluginAccess = createChatPluginAccess({ socket, requiredPluginsDeclared });
  const domainRegistryView = computed(() => getChatDomainRegistryView(socket.value));
  const { attachPluginHostBridge, detachPluginHostBridge } = usePluginHostBridge({
    socket,
    currentChannelId: deps.currentChannelId,
    sendComposerMessage: deps.sendComposerMessage,
  });

  const workspaceCoordinator = createChatWorkspaceCoordinator({
    workspace: {
      getCurrentSocket: () => socket.value,
      switchWorkspace(serverSocket: string): Promise<ServerWorkspaceActivationOutcome> {
        return switchChatServerWorkspace(serverSocket, {
          connect: true,
          refreshInfo: true,
        });
      },
    },
    plugins: {
      attachPluginHostBridge,
      refreshCatalog: pluginAccess.refreshCatalog,
      refreshDomainCatalog: refreshChatDomainCatalog,
      refreshRequiredPluginsState: pluginAccess.refreshRequiredPluginsState,
      async ensureRuntime(serverSocket: string): Promise<void> {
        if (!serverId.value) return;
        await ensureChatPluginRuntimeLoaded(serverSocket);
      },
      detachBridge: detachPluginHostBridge,
    },
    session: {
      ensureChatReady: deps.ensureChatReady,
    },
    onAsyncError: deps.onAsyncError,
  });

  watch(
    () => socket.value,
    () => {
      workspaceCoordinator.syncBridgeForCurrentSocket();
    },
  );

  return {
    socket,
    serverId,
    serverRacks: chatServerRacks,
    missingRequiredCount: pluginAccess.missingRequiredCount,
    quickSwitcherPlugins: computed(() => pluginAccess.quickSwitcherModules.value),
    domainRegistryView,
    handleSwitchServer(serverSocket: string): void {
      workspaceCoordinator.switchWorkspace(serverSocket);
    },
    bootstrapCurrentWorkspace: workspaceCoordinator.bootstrapCurrentWorkspace,
    disposeWorkspace: workspaceCoordinator.dispose,
  };
}
