/**
 * @fileoverview patchbay page model
 * @description
 * 收敛 MainPage 所需的页面级状态、导航、浮层、快捷键与生命周期装配，使页面本身只承担模板入口职责。
 */

import { computed, proxyRefs, ref, type ComputedRef, type Ref, type ShallowUnwrapRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "@/shared/utils/logger";
import type { ChatLinkPreview } from "@/features/chat/domain/types/chatApiModels";
import { currentChatUserId } from "@/features/chat/composition/chatAccountSession";
import {
  chatConnectionDetail,
  chatConnectionPillState,
  retryChatConnection,
} from "@/features/chat/composition/serverWorkspaceAdapter";
import { getMessageFlowCapabilities } from "@/features/chat/message-flow/api";
import type { DeleteChatMessageOutcome, MessageFlowCapabilities, RecallChatMessageOutcome } from "@/features/chat/message-flow/api-types";
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
import { useThreadPanelModel } from "../components/thread/useThreadPanelModel";
import { copyTextToClipboard } from "@/shared/utils/clipboard";
import { httpChatApiPort } from "@/features/chat/data/chat-api/httpChatApiPort";
import { ensureValidAccessToken } from "@/shared/net/auth/authSessionManager";
import { IS_STORE_MOCK } from "@/shared/config/runtime";
import { getChatAggregateStore } from "@/features/chat/composition/chat.di";
import type { ChannelSummary } from "@/features/chat/shared-kernel/channelSummary";
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
  channels: ComputedRef<readonly ChannelSummary[]>;
  editingMessageId: Ref<string>;
  handleEditMessage(messageId: string, text: string): void;
  clearEditingMessageId(): void;
  linkPreview: Ref<ChatLinkPreview | null>;
  fetchLinkPreview(url: string): Promise<void>;
  dismissLinkPreview(): void;
  threadPanel: ReturnType<typeof useThreadPanelModel>;
  domainRegistryStore: unknown;
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
  const editingMessageId = ref<string>("");
  const linkPreview = ref<ChatLinkPreview | null>(null);

  async function fetchLinkPreview(url: string): Promise<void> {
    try {
      const result = await invoke<ChatLinkPreview>("fetch_link_preview", { url });
      linkPreview.value = result;
    } catch {
      linkPreview.value = null;
    }
  }

  function dismissLinkPreview(): void {
    linkPreview.value = null;
  }

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
    showCreateChatMenu,
    createChatMenuX,
    createChatMenuY,
    showCreateChannel,
    showCreateFriendPrivateChat,
    showDeleteChannel,
    deleteChannelId,
    deleteChannelName,
    openCreateChatMenu,
    closeCreateChatMenu,
    setShowCreateChannel,
    setShowCreateFriendPrivateChat,
    setShowDeleteChannel,
    openCreateChannelDialog,
    openCreateFriendPrivateChatDialog,
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

  const channelRail = useChannelRailModel({
    directory: roomDirectory,
    currentSession,
    socket,
    serverId,
    missingRequiredCount,
    openPlugins: goPlugins,
    openRequiredSetup: handleOpenRequiredSetup,
    openCreateMenu: openCreateChatMenu,
    openChannelInfo,
    applyJoin: (channelId: string) => roomGovernance.forChannel(channelId).applyJoin(),
    onAsyncError: logAsyncError,
  });

  const membersRail = useMembersRailModel({
    members: roomGovernance.currentChannel.members,
  });

  function handleReplyShortcut(messageId: string): void {
    currentChannelMessageFlow.beginReply(messageId);
  }

  function handleDeleteShortcut(messageId: string): void {
    runAsyncTask(currentChannelMessageFlow.deleteMessage(messageId) as Promise<DeleteChatMessageOutcome>, "chat_delete_shortcut_failed");
  }

  function startEditingMessage(messageId: string): void {
    editingMessageId.value = messageId;
  }

  function clearEditingMessageId(): void {
    editingMessageId.value = "";
  }

  function handleEditMessage(messageId: string, text: string): void {
    runAsyncTask(
      currentChannelMessageFlow.editMessage(messageId, { text }).then((outcome) => {
        editingMessageId.value = "";
        if (!outcome.ok) {
          logger.error("Action: chat_edit_message_failed", {
            messageId,
            error: String(outcome.error),
          });
        }
      }),
      "chat_edit_message_failed",
    );
  }

  function getMessageClipboardText(messageId: string): string | null {
    const message = currentChannelMessageFlow.findMessageById(messageId);
    if (!message) return null;
    return message.kind === "core_text" ? message.text : message.preview;
  }

  // Forwarding variable to break circular dependency between useMessageContextMenu and chatCenter
  let _enterMultiSelectMode: ((messageId: string) => void) = () => {};
  let _openForwardDialog: ((messageId: string) => void) = () => {};

  const {
    menuOpen,
    menuX,
    menuY,
    menuMessageId,
    closeMenu,
    handleMenuAction,
    handleMessageContextMenu,
    handleMoreClick,
  } = useMessageContextMenu({
    getClipboardText: getMessageClipboardText,
    copyTextToClipboard,
    startReply: currentChannelMessageFlow.beginReply,
    startQuoteReply: (messageId: string, preview: string) => {
      const message = currentChannelMessageFlow.findMessageById(messageId);
      if (!message) return;
      messageComposer.startQuoteReply(messageId, message.from.id, preview);
    },
    deleteMessage: currentChannelMessageFlow.deleteMessage,
    recallMessage: (messageId: string) => {
      return currentChannelMessageFlow.recallMessage(messageId) as Promise<RecallChatMessageOutcome>;
    },
    onAsyncError: logAsyncError,
    enterMultiSelectMode: (messageId: string) => {
      _enterMultiSelectMode(messageId);
    },
    openForwardDialog: (messageId: string) => {
      _openForwardDialog(messageId);
    },
    startEditing: (messageId: string) => {
      startEditingMessage(messageId);
    },
    openThread: (messageId) => threadPanel.openThread(messageId),
  });

  const showEdit = computed(() => {
    const mid = menuMessageId.value;
    if (!mid) return false;
    const message = currentChannelMessageFlow.findMessageById(mid);
    if (!message) return false;
    if (message.from.id !== currentUserId.value) return false;
    return true;
  });

  const showRecall = computed(() => {
    const mid = menuMessageId.value;
    if (!mid) return false;
    const message = currentChannelMessageFlow.findMessageById(mid);
    if (!message) return false;
    if (message.from.id !== currentUserId.value) return false;
    if (message.recalledAt != null && message.recalledAt > 0) return false;
    return true;
  });

  const threadPanel = useThreadPanelModel({
    getThreadReplies: async (rootMessageId, cursor) => {
      if (IS_STORE_MOCK) {
        return { items: [], nextCursor: undefined, hasMore: false };
      }
      const s = socket.value;
      if (!s) return { items: [], nextCursor: undefined, hasMore: false };
      const token = (await ensureValidAccessToken(s)).trim();
      if (!token) return { items: [], nextCursor: undefined, hasMore: false };
      return httpChatApiPort.getThreadReplies(s, token, rootMessageId, cursor);
    },
    sendThreadReply: async (rootMessageId, text) => {
      if (IS_STORE_MOCK) return;
      const s = socket.value;
      if (!s) return;
      const token = (await ensureValidAccessToken(s)).trim();
      if (!token) return;
      const cid = currentSessionSnapshot.value.currentChannelId;
      await httpChatApiPort.sendChannelMessage(s, token, cid, {
        domain: "Core:Text",
        domainVersion: "1",
        data: { text, threadRootId: rootMessageId },
      });
    },
    findMessageById: (id) => currentChannelMessageFlow.findMessageById(id) as any,
    currentChannelId: currentSessionSnapshot.value.currentChannelId,
  });

  const showViewThread = computed(() => {
    const mid = menuMessageId.value;
    if (!mid) return false;
    const message = currentChannelMessageFlow.findMessageById(mid);
    if (!message) return false;
    return (message as { threadReplyCount?: number }).threadReplyCount != null && (message as { threadReplyCount?: number }).threadReplyCount! > 0;
  });

  const currentChannelName = computed(() => {
    const channel = roomDirectory.findChannelById(currentSessionSnapshot.value.currentChannelId);
    return channel?.name ?? currentSessionSnapshot.value.currentChannelId;
  });

  const membersSnapshot = useObservedCapabilitySnapshot(roomGovernance.currentChannel.members);
  const currentUserRole = computed(() => {
    const member = membersSnapshot.value.find((m) => m.id === currentUserId.value);
    return member?.role ?? "member";
  });

  const chatCenter = useChatCenterModel({
    currentSession,
    currentTimeline: currentChannelMessageFlow,
    messageComposer,
    lookupChannel: messageFlow.forChannel,
    currentUserId,
    currentUserRole,
    currentChannelName,
    connectionDetail: chatConnectionDetail,
    connectionPillState: chatConnectionPillState,
    retryConnection: retryChatConnection,
    domainRegistryView,
    onLoadMoreMessages: handleLoadMoreMessages,
    onReplyShortcut: handleReplyShortcut,
    onDeleteShortcut: handleDeleteShortcut,
    onMessageContextMenu: handleMessageContextMenu,
    onForwardMessage: async (mid, req) => {
      if (IS_STORE_MOCK) {
        await getChatAggregateStore().forwardMessage(mid, req);
        return;
      }
      const s = socket.value;
      if (!s) return;
      const token = (await ensureValidAccessToken(s)).trim();
      if (!token) return;
      await httpChatApiPort.forwardMessage(s, token, mid, {
        targetCid: req.targetCid,
        comment: req.comment,
        mergedMids: req.mergedMids,
      });
    },
    linkPreview,
    fetchLinkPreview,
    dismissLinkPreview,
    selectChannel: async (channelId: string) => {
      await currentSession.selectChannel(channelId);
    },
  });

  // Wire up the circular dependency after chatCenter is created
  _enterMultiSelectMode = (messageId: string) => {
    chatCenter.enterMultiSelectMode(messageId);
  };
  _openForwardDialog = (messageId: string) => {
    chatCenter.handleSingleForward(messageId);
  };

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
    showCreateChatMenu,
    showCreateChannel,
    showCreateFriendPrivateChat,
    showDeleteChannel,
    closeQuickSwitcher,
    openQuickSwitcher,
    closeMenu,
    closeChannelMenu,
    closeCreateChatMenu,
    setShowCreateChannel,
    setShowCreateFriendPrivateChat,
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
    handleOpenFiles: () => {
      void router.push("/files");
    },
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
    showEdit,
    showRecall,
    showViewThread,
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
    showCreateChatMenu,
    createChatMenuX,
    createChatMenuY,
    showCreateChannel,
    showCreateFriendPrivateChat,
    showDeleteChannel,
    deleteChannelId,
    deleteChannelName,
    closeCreateChatMenu,
    setShowCreateChannel,
    setShowCreateFriendPrivateChat,
    setShowDeleteChannel,
    openCreateChannelDialog,
    openCreateFriendPrivateChatDialog,
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

  const channels = computed(() => roomDirectorySnapshot.value.allChannels as readonly ChannelSummary[]);

  const rawModel: PatchbayPageRawModel = {
    flashMessage,
    serverRail,
    channels,
    channelRail,
    chatCenter,
    membersRail,
    chatViewport,
    messageContextMenu,
    channelSettingsMenu,
    channelDialogs,
    quickSwitcher,
    editingMessageId,
    handleEditMessage,
    clearEditingMessageId,
    linkPreview,
    fetchLinkPreview,
    dismissLinkPreview,
    threadPanel,
    domainRegistryStore: domainRegistryView,
  };

  return proxyRefs(rawModel);
}
