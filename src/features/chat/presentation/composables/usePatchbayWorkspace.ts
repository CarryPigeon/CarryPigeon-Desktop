/**
 * @fileoverview patchbay workspace model
 * @description
 * 收敛 Patchbay 主页面依赖的 server workspace、plugin gate、domain registry 与工作区切换动作。
 */

import { computed, watch, type ComputedRef, type Ref } from "vue";
import type { ComposerSubmitPayload, SendChatMessageOutcome } from "@/features/chat/message-flow/api-types";
import type { ServerWorkspaceActivationOutcome } from "@/features/server-connection/api-types";
import {
  chatServerRacks,
  switchChatServerWorkspace,
  useChatServerWorkspace,
} from "@/features/chat/data/server-workspace";
import { createChatPluginAccess } from "@/features/chat/data/plugin-access";
import {
  ensureChatPluginRuntimeLoaded,
  getChatDomainRegistryView,
  refreshChatDomainCatalog,
} from "@/features/chat/data/plugin-runtime";
import {
  type ChatWorkspaceBootstrapOutcome,
  createChatWorkspaceCoordinator,
  type ChatWorkspaceSwitchOutcome,
} from "@/features/chat/application/runtime/createChatWorkspaceCoordinator";
import { usePluginHostBridge } from "./usePluginHostBridge";

type RefLike<T> = Ref<T> | ComputedRef<T>;

export type UsePatchbayWorkspaceDeps = {
  currentChannelId: RefLike<string>;
  sendComposerMessage(payload: ComposerSubmitPayload): Promise<SendChatMessageOutcome>;
  ensureChatReady(): Promise<void>;
};

export type PatchbayWorkspaceModel = {
  socket: ComputedRef<string>;
  serverId: ComputedRef<string>;
  serverRacks: typeof chatServerRacks;
  missingRequiredCount: ComputedRef<number>;
  quickSwitcherPlugins: ComputedRef<readonly { pluginId: string; name: string }[]>;
  domainRegistryView: ComputedRef<ReturnType<typeof getChatDomainRegistryView>>;
  handleSwitchServer(serverSocket: string): Promise<ChatWorkspaceSwitchOutcome>;
  bootstrapCurrentWorkspace(): Promise<ChatWorkspaceBootstrapOutcome>;
  disposeWorkspace(): void;
};

/**
 * 构建 Patchbay 主页面工作区模型。
 *
 * 它只处理 workspace 级协作：
 * - server workspace 切换；
 * - plugin runtime / required plugins / host bridge；
 * - chat ready 启动编排。
 *
 * 不处理：
 * - 频道目录或当前频道状态；
 * - 消息时间线与治理页面的数据读取。
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

  /**
   * coordinator 把“切服后要连带完成的事情”收束成一条工作流，
   * 避免这些步骤散落在页面 composable 里。
   */
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
  });

  watch(
    () => socket.value,
    () => {
      // socket 变化后仅同步 plugin host bridge；其余重型流程交给 coordinator 显式触发。
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
    handleSwitchServer(serverSocket: string): Promise<ChatWorkspaceSwitchOutcome> {
      return workspaceCoordinator.switchWorkspace(serverSocket);
    },
    bootstrapCurrentWorkspace: workspaceCoordinator.bootstrapCurrentWorkspace,
    disposeWorkspace: workspaceCoordinator.dispose,
  };
}
