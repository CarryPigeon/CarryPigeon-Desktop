/**
 * @fileoverview patchbay page model
 * @description
 * 收敛 MainPage 所需的页面级状态、导航、浮层、快捷键与生命周期装配，使页面本身只承担模板入口职责。
 */

import { computed, proxyRefs, ref, type Ref, type ShallowUnwrapRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { createLogger } from "@/shared/utils/logger";
import { useChannelNavigation } from "./useChannelNavigation";
import { useSignalViewport } from "./useSignalViewport";
import { usePatchbayLifecycle } from "./usePatchbayLifecycle";
import { useQuickSwitcher } from "./useQuickSwitcher";
import { useMessageContextMenu } from "./useMessageContextMenu";
import { useChannelSettingsMenu } from "./useChannelSettingsMenu";
import { useChannelDialogs } from "./useChannelDialogs";
import { createAsyncTaskRunner } from "./asyncTaskRunner";
import { usePatchbayHotkeys } from "./usePatchbayHotkeys";
import { usePluginNavigation } from "./usePluginNavigation";
import { usePatchbayWorkspace } from "./usePatchbayWorkspace";
import { useChannelRailModel } from "./useChannelRailModel";
import { useMembersRailModel } from "./useMembersRailModel";
import { useChatCenterModel } from "./useChatCenterModel";
import { getRoomSessionCapabilities } from "@/features/chat/room-session/api";
import { getMessageFlowCapabilities } from "@/features/chat/message-flow/api";
import { copyTextToClipboard } from "@/shared/utils/clipboard";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";
import type { DeleteChatMessageOutcome } from "@/features/chat/message-flow/contracts";
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

const roomSessionCapabilities = getRoomSessionCapabilities();
const messageFlowCapabilities = getMessageFlowCapabilities();

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

export type PatchbayPageModel = ShallowUnwrapRef<PatchbayPageRawModel>;

export function usePatchbayPageModel(): PatchbayPageModel {
  const router = useRouter();
  const route = useRoute();
  const logger = createLogger("MainPage");
  const roomDirectory = roomSessionCapabilities.directory;
  const currentSession = roomSessionCapabilities.currentChannel;
  const currentChannelMessageFlow = messageFlowCapabilities.currentChannel;
  const messageComposer = messageFlowCapabilities.composer;
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
    logger.error(`Action: ${action}`, { error: String(error) });
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
    onAsyncError: logAsyncError,
  });
  const { goPlugins, handleInstallHint } = usePluginNavigation(router, missingRequiredCount);

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
    handleSwitchServer(serverSocket);
  }

  function handleQuickSwitcherChannelDiscoverFocus(channelName: string): void {
    roomDirectory.focusDiscoverChannel(channelName);
  }

  const channelRail = useChannelRailModel({
    socket,
    serverId,
    missingRequiredCount,
    openPlugins: goPlugins,
    openRequiredSetup: handleOpenRequiredSetup,
    openCreateChannel: () => setShowCreateChannel(true),
    openChannelInfo,
  });

  const membersRail = useMembersRailModel();

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
    bootstrap: bootstrapCurrentWorkspace,
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

  const serverRail = createPatchbayServerRailSection({
    racks: serverRacks,
    activeSocket: socket,
    handleSwitchServer,
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
    handleAction: handleMenuAction,
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
