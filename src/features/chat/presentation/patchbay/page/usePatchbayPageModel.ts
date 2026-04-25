/**
 * @fileoverview patchbay page model
 * @description
 * 收敛 MainPage 所需的页面级状态、导航、浮层、快捷键与生命周期装配，使页面本身只承担模板入口职责。
 */

import { computed, proxyRefs, ref, type Ref, type ShallowUnwrapRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { createLogger } from "@/shared/utils/logger";
import { currentChatUserId } from "@/features/chat/data/account-session";
import {
  chatConnectionDetail,
  chatConnectionPillState,
  retryChatConnection,
} from "@/features/chat/data/server-workspace/chatServerWorkspaceAdapter";
import { getMessageFlowCapabilities } from "@/features/chat/message-flow/api";
import type { DeleteChatMessageOutcome, MessageFlowCapabilities } from "@/features/chat/message-flow/api-types";
import { getRoomGovernanceCapabilities } from "@/features/chat/room-governance/api";
import type { RoomGovernanceCapabilities } from "@/features/chat/room-governance/api-types";
import { getRoomSessionCapabilities } from "@/features/chat/room-session/api";
import type { RoomSessionCapabilities } from "@/features/chat/room-session/api-types";
import { useChannelNavigation } from "../navigation/useChannelNavigation";
import { useSignalViewport } from "../interactions/useSignalViewport";
import { usePatchbayLifecycle } from "./usePatchbayLifecycle";
import { useQuickSwitcher } from "../interactions/useQuickSwitcher";
import { useMessageContextMenu } from "../interactions/useMessageContextMenu";
import { useChannelSettingsMenu } from "../interactions/useChannelSettingsMenu";
import { useChannelDialogs } from "../interactions/useChannelDialogs";
import { createAsyncTaskRunner } from "../interactions/asyncTaskRunner";
import { usePatchbayHotkeys } from "../interactions/usePatchbayHotkeys";
import { usePluginNavigation } from "../navigation/usePluginNavigation";
import { usePatchbayWorkspace } from "./usePatchbayWorkspace";
import { useChannelRailModel } from "../view-models/useChannelRailModel";
import { useMembersRailModel } from "../view-models/useMembersRailModel";
import { useChatCenterModel } from "../view-models/useChatCenterModel";
import { copyTextToClipboard } from "@/shared/utils/clipboard";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";
import {
  createPatchbayChannelDialogsSection,
  createPatchbayChannelSettingsMenuSection,
  createPatchbayChatViewportSection,
  createPatchbayMessageContextMenuSection,
  createPatchbayQuickSwitcherSection,
  createPatchbayServerRailSection,
  type PatchbayChannelDialogsModel,
  type PatchbayChannelSettingsMenuModel,
  type PatchbayChatViewportModel,
  type PatchbayMessageContextMenuModel,
  type PatchbayQuickSwitcherModel,
  type PatchbayServerRailModel,
} from "./patchbayPageSections";

type PatchbayPageFeatureDeps = {
  roomSession: RoomSessionCapabilities;
  messageFlow: MessageFlowCapabilities;
  roomGovernance: RoomGovernanceCapabilities;
};

function resolvePatchbayPageFeatureDeps(): PatchbayPageFeatureDeps {
  return {
    roomSession: getRoomSessionCapabilities(),
    messageFlow: getMessageFlowCapabilities(),
    roomGovernance: getRoomGovernanceCapabilities(),
  };
}

/**
 * MainPage 最终消费的页面模型。
 *
 * 这里故意按 UI section 分组，而不是把几十个 `ref/computed/action`
 * 平铺导出给页面模板。
 */
type PatchbayPageRawModel = {
  flashMessage: Ref<string>;
  serverRail: PatchbayServerRailModel;
  channelRail: ReturnType<typeof useChannelRailModel>;
  chatCenter: ReturnType<typeof useChatCenterModel>;
  membersRail: ReturnType<typeof useMembersRailModel>;
  chatViewport: PatchbayChatViewportModel;
  messageContextMenu: PatchbayMessageContextMenuModel;
  channelSettingsMenu: PatchbayChannelSettingsMenuModel;
  channelDialogs: PatchbayChannelDialogsModel;
  quickSwitcher: PatchbayQuickSwitcherModel;
};

/**
 * Patchbay 主页面模型。
 */
export type PatchbayPageModel = ShallowUnwrapRef<PatchbayPageRawModel>;

/**
 * Patchbay 主页面 composition root。
 *
 * 阅读建议：
 * 1. 先看这里依赖了哪些 capability；
 * 2. 再看 workspace / section model / lifecycle 各自怎么组装；
 * 3. 最后才回到具体组件。
 */
export function usePatchbayPageModel(): PatchbayPageModel {
  const router = useRouter();
  const route = useRoute();
  const logger = createLogger("MainPage");
  const { roomSession, messageFlow, roomGovernance } = resolvePatchbayPageFeatureDeps();
  const roomDirectory = roomSession.directory;
  const currentSession = roomSession.currentChannel;
  const currentChannelMessageFlow = messageFlow.currentChannel;
  const messageComposer = messageFlow.composer;
  const currentUserId = computed(() => currentChatUserId.value);
  const roomDirectorySnapshot = useObservedCapabilitySnapshot(roomDirectory);
  const currentSessionSnapshot = useObservedCapabilitySnapshot(currentSession);
  const messageTimelineSnapshot = useObservedCapabilitySnapshot(currentChannelMessageFlow);
  const {
    findChannelById,
    openChannelInfo,
    openChannelMembers,
    openJoinApplications,
    openChannelBans,
  } = useChannelNavigation({
    allChannels: computed(() => roomDirectorySnapshot.value.allChannels),
  });
  const flashMessage = ref<string>("");

  function logAsyncError(action: string, error: unknown): void {
    logger.error("Action: chat_patchbay_async_task_failed", {
      action,
      error: String(error),
    });
  }

  const runAsyncTask = createAsyncTaskRunner(logAsyncError);
  const {
    socket,
    serverId,
    serverRacks,
    missingRequiredCount,
    quickSwitcherPlugins,
    domainRegistryView,
    handleSwitchServer,
    bootstrapCurrentWorkspace,
    disposeWorkspace,
  } = usePatchbayWorkspace({
    currentChannelId: computed(() => currentSessionSnapshot.value.currentChannelId),
    sendComposerMessage: messageComposer.sendMessage,
    ensureChatReady: currentSession.ensureReady,
  });
  const { goPlugins, handleInstallHint } = usePluginNavigation(router, missingRequiredCount);

  function runServerSwitch(serverSocket: string): void {
    runAsyncTask(
      handleSwitchServer(serverSocket).then((outcome) => {
        if (!outcome.ok) logAsyncError("chat_switch_server_rejected", outcome.error);
        return outcome;
      }),
      "chat_switch_server_failed",
    );
  }

  async function bootstrapWorkspace(): Promise<void> {
    const outcome = await bootstrapCurrentWorkspace();
    if (!outcome.ok) logAsyncError("chat_patchbay_bootstrap_rejected", outcome.error);
  }

  function handleQuickSwitcherRouteSelect(path: string): void {
    void router.push(path);
  }

  function handleQuickSwitcherPluginSelect(pluginId: string): void {
    void router.push({ path: "/plugins", query: { focus_plugin_id: pluginId } });
  }

  function handleOpenServers(): void {
    void router.push("/servers");
  }

  function handleOpenSettings(): void {
    void router.push("/settings");
  }

  function handleOpenRequiredSetup(): void {
    void router.push("/required-setup");
  }

  function handleQuickSwitcherServerSelect(serverSocket: string): void {
    runServerSwitch(serverSocket);
  }

  function handleQuickSwitcherChannelDiscoverFocus(channelName: string): void {
    roomDirectory.focusDiscoverChannel(channelName);
  }

  const channelRail = useChannelRailModel({
    directory: roomDirectory,
    currentSession,
    socket,
    serverId,
    missingRequiredCount,
    openPlugins: goPlugins,
    openRequiredSetup: handleOpenRequiredSetup,
    openCreateChannel: () => setShowCreateChannel(true),
    openChannelInfo,
    applyJoin: (channelId: string) => roomGovernance.forChannel(channelId).applyJoin(),
    onAsyncError: logAsyncError,
  });

  const membersRail = useMembersRailModel({
    members: roomGovernance.currentChannel.members,
  });

  const {
    signalPaneRef,
    showJumpToBottom,
    setSignalPaneRef,
    handleSignalScroll,
    handleLoadMoreMessages,
    handleJumpToBottom,
    maybeReportReadState,
    handleWindowFocus,
    handleVisibilityChange,
  } = useSignalViewport({
    currentChannelId: computed(() => currentSessionSnapshot.value.currentChannelId),
    currentMessageCount: computed(() => messageTimelineSnapshot.value.currentMessageCount),
    currentChannelHasMore: computed(() => messageTimelineSnapshot.value.hasMoreHistory),
    loadingMoreMessages: computed(() => messageTimelineSnapshot.value.isLoadingHistory),
    loadMoreMessages: currentChannelMessageFlow.loadMoreHistory,
    reportCurrentReadState: currentSession.reportReadState,
    onAsyncError: logAsyncError,
  });

  const {
    showChannelMenu,
    channelMenuX,
    channelMenuY,
    openChannelSettingsMenu,
    closeChannelMenu,
  } = useChannelSettingsMenu();

  const {
    showCreateChannel,
    showDeleteChannel,
    deleteChannelId,
    deleteChannelName,
    setShowCreateChannel,
    setShowDeleteChannel,
    handleChannelCreated,
    openDeleteChannelDialog,
    handleChannelDeleted,
  } = useChannelDialogs({
    currentChannelId: computed(() => currentSessionSnapshot.value.currentChannelId),
    channels: computed(() => roomDirectorySnapshot.value.visibleChannels),
    findChannelById,
    selectChannel: currentSession.selectChannel,
    closeChannelMenu,
    onAsyncError: logAsyncError,
  });

  function handleReplyShortcut(messageId: string): void {
    currentChannelMessageFlow.beginReply(messageId);
  }

  function handleDeleteShortcut(messageId: string): void {
    runAsyncTask(currentChannelMessageFlow.deleteMessage(messageId) as Promise<DeleteChatMessageOutcome>, "chat_delete_shortcut_failed");
  }

  function getMessageClipboardText(messageId: string): string | null {
    const message = currentChannelMessageFlow.findMessageById(messageId);
    if (!message) return null;
    return message.kind === "core_text" ? message.text : message.preview;
  }

  const {
    menuOpen,
    menuX,
    menuY,
    closeMenu,
    handleMenuAction,
    handleMessageContextMenu,
    handleMoreClick,
  } = useMessageContextMenu({
    getClipboardText: getMessageClipboardText,
    copyTextToClipboard,
    startReply: currentChannelMessageFlow.beginReply,
    deleteMessage: currentChannelMessageFlow.deleteMessage,
    onAsyncError: logAsyncError,
  });

  const chatCenter = useChatCenterModel({
    currentSession,
    currentTimeline: currentChannelMessageFlow,
    messageComposer,
    lookupChannel: messageFlow.forChannel,
    currentUserId,
    connectionDetail: chatConnectionDetail,
    connectionPillState: chatConnectionPillState,
    retryConnection: retryChatConnection,
    domainRegistryView,
    onLoadMoreMessages: handleLoadMoreMessages,
    onReplyShortcut: handleReplyShortcut,
    onDeleteShortcut: handleDeleteShortcut,
    onMessageContextMenu: handleMessageContextMenu,
  });

  const {
    quickSwitcherOpen,
    quickSwitcherQuery,
    quickSwitcherActiveIndex,
    qsItems,
    setQuickOpen,
    setQuickQuery,
    setQuickActiveIndex,
    handleQuickSelect,
    openQuickSwitcher,
    closeQuickSwitcher,
  } = useQuickSwitcher({
    serverRacks,
    allChannels: computed(() => roomDirectorySnapshot.value.allChannels),
    plugins: quickSwitcherPlugins,
    findChannelById,
    onRouteSelect: handleQuickSwitcherRouteSelect,
    onServerSelect: handleQuickSwitcherServerSelect,
    onChannelSelect: currentSession.selectChannel,
    onChannelDiscoverFocus: handleQuickSwitcherChannelDiscoverFocus,
    onModuleSelect: handleQuickSwitcherPluginSelect,
    onAsyncError: logAsyncError,
  });

  const { onKeydown } = usePatchbayHotkeys({
    quickSwitcherOpen,
    menuOpen,
    showChannelMenu,
    showCreateChannel,
    showDeleteChannel,
    closeQuickSwitcher,
    openQuickSwitcher,
    closeMenu,
    closeChannelMenu,
    setShowCreateChannel,
    setShowDeleteChannel,
    goPlugins,
    openSettings: handleOpenSettings,
  });

  usePatchbayLifecycle({
    route,
    router,
    flashMessage,
    bootstrap: bootstrapWorkspace,
    signalPaneRef,
    maybeReportReadState,
    onKeydown,
    onWindowFocus: handleWindowFocus,
    onVisibilityChange: handleVisibilityChange,
    dispose: disposeWorkspace,
    onBootstrapError: (error: unknown) => {
      logger.error("Action: chat_patchbay_bootstrap_failed", { error: String(error) });
    },
  });

  /**
   * 下半段只做 section model 装配：
   * - 上半段先把跨 feature 协调、局部 capability、页面交互逻辑收拢；
   * - 这里再把它们投影给 layout/components 直接消费。
   */
  const serverRail = createPatchbayServerRailSection({
    racks: serverRacks,
    activeSocket: socket,
    handleSwitchServer: runServerSwitch,
    handleOpenServers,
    handleOpenSettings,
    goPlugins,
  });

  const chatViewport = createPatchbayChatViewportSection({
    showJumpToBottom,
    setSignalPaneRef,
    handleJumpToBottom,
    handleSignalScroll,
    openChannelSettingsMenu,
    handleMessageContextMenu,
    handleMoreClick,
    handleInstallHint,
  });

  const messageContextMenu = createPatchbayMessageContextMenuSection({
    open: menuOpen,
    x: menuX,
    y: menuY,
    close: closeMenu,
    handleMenuCommand: handleMenuAction,
  });

  const channelSettingsMenu = createPatchbayChannelSettingsMenuSection({
    open: showChannelMenu,
    x: channelMenuX,
    y: channelMenuY,
    close: closeChannelMenu,
    openMembers: openChannelMembers,
    openJoinApplications,
    openChannelBans,
    openDeleteChannelDialog,
  });

  const channelDialogs = createPatchbayChannelDialogsSection({
    showCreateChannel,
    showDeleteChannel,
    deleteChannelId,
    deleteChannelName,
    setShowCreateChannel,
    setShowDeleteChannel,
    handleChannelCreated,
    handleChannelDeleted,
  });

  const quickSwitcher = createPatchbayQuickSwitcherSection({
    open: quickSwitcherOpen,
    query: quickSwitcherQuery,
    activeIndex: quickSwitcherActiveIndex,
    items: qsItems,
    setOpen: setQuickOpen,
    setQuery: setQuickQuery,
    setActiveIndex: setQuickActiveIndex,
    handleSelect: handleQuickSelect,
  });

  const rawModel: PatchbayPageRawModel = {
    flashMessage,
    serverRail,
    channelRail,
    chatCenter,
    membersRail,
    chatViewport,
    messageContextMenu,
    channelSettingsMenu,
    channelDialogs,
    quickSwitcher,
  };

  return proxyRefs(rawModel);
}
