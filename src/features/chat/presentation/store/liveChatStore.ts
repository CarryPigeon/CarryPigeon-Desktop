/**
 * @fileoverview 聊天实时 Store（HTTP + WS 事件流）。
 * @description chat｜展示层状态（store）：liveChatStore。
 * 实现聊天领域的核心交互闭环：
 * - HTTP：频道列表/未读/历史消息/成员/管理操作等
 * - WS：实时事件（新消息/删除/读状态/频道变更提示）
 *
 * 设计目标：
 * - 尽量把“协议语义”收敛在 store 内，UI 只消费状态与 action。
 * - 在 WS 不可用（如自签证书场景）时，自动降级为 HTTP polling。
 */

import { computed, reactive, ref, watch } from "vue";
import { readAuthToken } from "@/shared/utils/localState";
import { createLogger } from "@/shared/utils/logger";
import { ensureValidAccessToken, onAuthSessionChanged, startAuthSessionAutoRefresh } from "@/shared/net/auth/authSessionManager";
import { toHttpOrigin } from "@/shared/net/http/serverOrigin";
import { currentUser } from "@/features/user/api";
import { currentServerSocket, getTlsConfigForSocket, useServerInfoStore } from "@/features/servers/api";
import { dispatchChannelChanged } from "@/shared/utils/messageEvents";
import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { ChatEventsPort } from "@/features/chat/domain/ports/chatEventsPort";
import type { ChatChannel, ChatMessage, ChatMember, ChatStore } from "./chatStoreTypes";
import { compareMessages, mapWireMessage, mergeMessages } from "./liveChat/liveChatMessageModel";
import { createLiveChatChannelAdminActions } from "./liveChat/liveChatChannelAdminActions";
import { createLiveChatChannelData } from "./liveChat/liveChatChannelData";
import { createResumeFailedCatchUp } from "./liveChat/liveChatCatchUp";
import { createLiveChatPollingFallback } from "./liveChat/liveChatPollingFallback";
import { createLiveChatWsManager } from "./liveChat/liveChatWsManager";
import { createLiveChatWsEventHandler } from "./liveChat/liveChatWsEventHandler";
import { createLiveChatMessagePaging } from "./liveChat/liveChatMessagePaging";
import { createLiveChatEnsureReady } from "./liveChat/liveChatEnsureReady";
import { createLiveChatReadStateReporter } from "./liveChat/liveChatReadStateReporter";
import { createLiveChatDomains } from "./liveChat/liveChatDomains";
import { createLiveChatChannelViewActions } from "./liveChat/liveChatChannelView";
import { createLiveChatUserActions } from "./liveChat/liveChatUserActions";
import { createLiveChatComposerActions } from "./liveChat/liveChatComposerActions";
import { resetLiveChatState } from "./liveChat/liveChatReset";

const logger = createLogger("liveChatStore");

/**
 * liveChatStore 的依赖集合（API + 事件端口）。
 */
export type LiveChatStoreDeps = {
  api: ChatApiPort;
  events: ChatEventsPort;
};

/**
 * 轮询间隔（WS 降级模式）。
 */
const POLL_INTERVAL_MS = 8000;

/**
 * `resume.failed` 后的补拉 fan-out 上限（避免风暴）。
 */
const CATCH_UP_PREFETCH_LIMIT = 5;

/**
 * 创建 live chat store 实例。
 *
 * @param deps - API + events 端口依赖。
 * @returns ChatStore。
 */
export function createLiveChatStore(deps: LiveChatStoreDeps): ChatStore {
  const channelsRef = ref<ChatChannel[]>([]);
  const channelSearch = ref<string>("");
  const channelTab = ref<"joined" | "discover">("joined");
  const composerDraft = ref<string>("");
  const selectedDomainId = ref<string>("Core:Text");
  const replyToMessageId = ref<string>("");
  const sendError = ref<string>("");
  const currentChannelId = ref<string>("");
  const members = ref<ChatMember[]>([]);

  const messagesByChannel = reactive<Record<string, ChatMessage[]>>({});
  const lastReadTimeMsByChannel = reactive<Record<string, number>>({});
  const lastReadReportAtMsByChannel = reactive<Record<string, number>>({});
  const nextCursorByChannel = reactive<Record<string, string>>({});
  const hasMoreByChannel = reactive<Record<string, boolean>>({});
  const loadingMoreMessages = ref<boolean>(false);

  const wsManager = createLiveChatWsManager(deps.events);
  let stopAutoRefresh: (() => void) | null = null;
  let stopSessionListener: (() => void) | null = null;
  let polling: ReturnType<typeof createLiveChatPollingFallback> | null = null;

  const allChannels = computed(() => channelsRef.value);

  const channels = computed(() => {
    const needle = channelSearch.value.trim().toLowerCase();
    const base: ChatChannel[] = [];
    const showJoined = channelTab.value === "joined";
    for (const c of channelsRef.value) {
      const ok = showJoined ? c.joined : !c.joined;
      if (ok) base.push(c);
    }
    if (!needle) return base;
    const filtered: ChatChannel[] = [];
    for (const c of base) {
      if (c.name.toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle)) filtered.push(c);
    }
    return filtered;
  });

  const currentMessages = computed(() => messagesByChannel[currentChannelId.value] ?? []);
  const currentChannelHasMore = computed(() => Boolean(hasMoreByChannel[currentChannelId.value]));
  const currentChannelLoadingMore = computed(() => loadingMoreMessages.value);
  const currentChannelLastReadTimeMs = computed(() => lastReadTimeMsByChannel[currentChannelId.value] ?? 0);

  /**
   * 若正在进行 HTTP 轮询（WS 降级模式），则停止轮询。
   *
   * @returns void
   */
  function stopPolling(): void {
    if (!polling) return;
    polling.stop();
  }

  /**
   * 停止“按 server 维度”的会话钩子（自动刷新 + 会话监听）。
   *
   * @returns void
   */
  function stopSessionHooks(): void {
    if (stopAutoRefresh) stopAutoRefresh();
    if (stopSessionListener) stopSessionListener();
    stopAutoRefresh = null;
    stopSessionListener = null;
  }

  /**
   * 获取当前 server socket 与可用 access token。
   *
   * 若本地 token 接近过期且存在 refresh_token，会优先尝试刷新，避免立刻鉴权失败。
   *
   * @returns 二元组 `[socket, token]`（均已 trim）。
   */
  async function getSocketAndValidToken(): Promise<[string, string]> {
    const socket = currentServerSocket.value.trim();
    if (!socket) return ["", ""];
    const token = (await ensureValidAccessToken(socket)).trim() || readAuthToken(socket).trim();
    return [socket, token];
  }

  const { refreshChannels } = createLiveChatChannelData({
    api: deps.api,
    getSocketAndValidToken,
    channelsRef,
    lastReadTimeMsByChannel,
  });

  const { loadChannelMessages, refreshChannelLatestPage, loadMoreMessages } = createLiveChatMessagePaging({
    api: deps.api,
    mapWireMessage,
    mergeMessages,
    getSocketAndValidToken,
    currentChannelId,
    messagesByChannel,
    nextCursorByChannel,
    hasMoreByChannel,
    loadingMoreMessages,
  });

  /**
   * 刷新某频道的成员侧栏（尽力而为）。
   *
   * @param cid - 频道 id。
   * @returns Promise<void>
   */
  async function refreshMembersRail(cid: string): Promise<void> {
    const channelId = String(cid).trim();
    if (!channelId) return;
    try {
      const list = await listMembers(channelId);
      const out: ChatMember[] = [];
      for (const m of list) {
        const role = m.role === "owner" || m.role === "admin" ? (m.role as "owner" | "admin") : "member";
        out.push({ id: m.uid, name: m.nickname || `u:${String(m.uid).slice(-6)}`, role });
      }
      members.value = out;
    } catch {
      members.value = [];
    }
  }

  const handleWsEvent = createLiveChatWsEventHandler({
    logger,
    getServerSocket: () => currentServerSocket.value.trim(),
    getCurrentChannelId: () => currentChannelId.value.trim(),
    getCurrentUserId: () => currentUser.id,
    channelsRef,
    messagesByChannel,
    lastReadTimeMsByChannel,
    refreshChannels,
    refreshChannelLatestPage,
    refreshMembersRail,
    dispatchChannelChanged,
    mapWireMessage,
    compareMessages,
  });

  const catchUpAfterResumeFailed = createResumeFailedCatchUp({
    logger,
    getActiveServerSocket: () => currentServerSocket.value.trim(),
    getCurrentChannelId: () => currentChannelId.value.trim(),
    listChannels: () => channelsRef.value,
    refreshChannels,
    refreshChannelLatestPage,
    refreshMembersRail,
    prefetchLimit: CATCH_UP_PREFETCH_LIMIT,
  });

  polling = createLiveChatPollingFallback({
    intervalMs: POLL_INTERVAL_MS,
    getActiveServerSocket: () => currentServerSocket.value.trim(),
    getCurrentChannelId: () => currentChannelId.value.trim(),
    refreshChannels,
    refreshChannelLatestPage,
  });

  const readStateReporter = createLiveChatReadStateReporter({
    api: deps.api,
    getSocketAndValidToken,
    lastReadTimeMsByChannel,
    lastReadReportAtMsByChannel,
  });

  const ensureChatReady = createLiveChatEnsureReady({
    logger,
    getSocketAndValidToken,
    refreshChannels,
    loadChannelMessages,
    refreshMembersRail,
    getCurrentChannelId: () => currentChannelId.value.trim(),
    setCurrentChannelIdIfEmpty: () => {
      if (!currentChannelId.value) currentChannelId.value = channelsRef.value[0]?.id ?? "";
    },
    getTlsPolicyForSocket: (socketKey) => getTlsConfigForSocket(socketKey).tlsPolicy,
    toHttpOrigin,
    getWsUrlOverride: (socketKey) => String(useServerInfoStore(socketKey).info.value?.wsUrl ?? "").trim() || undefined,
    wsManager,
    polling,
    stopPolling,
    startAutoRefresh: startAuthSessionAutoRefresh,
    onAuthSessionChanged,
    getStopAutoRefresh: () => stopAutoRefresh,
    setStopAutoRefresh: (stopper) => {
      stopAutoRefresh = stopper;
    },
    getStopSessionListener: () => stopSessionListener,
    setStopSessionListener: (stopper) => {
      stopSessionListener = stopper;
    },
    onWsEvent: handleWsEvent,
    onResumeFailed: (socketKey, reason) => {
      void catchUpAfterResumeFailed(socketKey, reason);
    },
  });

  const { availableDomains } = createLiveChatDomains({
    getActiveServerSocket: () => currentServerSocket.value.trim(),
  });

  const { getMessageById, selectChannel, reportCurrentReadState } = createLiveChatChannelViewActions({
    channelsRef,
    currentChannelId,
    messagesByChannel,
    lastReadTimeMsByChannel,
    lastReadReportAtMsByChannel,
    loadChannelMessages,
    refreshMembersRail,
    readStateReporter,
  });

  const { applyJoin, updateChannelMeta, deleteMessage } = createLiveChatUserActions({
    api: deps.api,
    getSocketAndValidToken,
    refreshChannels,
    channelsRef,
    currentChannelId,
    messagesByChannel,
    sendError,
  });

  const { startReply, cancelReply, sendComposerMessage } = createLiveChatComposerActions({
    api: deps.api,
    getSocketAndValidToken,
    currentChannelId,
    messagesByChannel,
    selectedDomainId,
    composerDraft,
    replyToMessageId,
    sendError,
    mapWireMessage,
    readStateReporter,
  });

  watch(
    () => currentServerSocket.value,
    () => {
      resetLiveChatState({
        wsManager,
        stopPolling,
        stopSessionHooks,
        channelsRef,
        members,
        currentChannelId,
        messagesByChannel,
        lastReadTimeMsByChannel,
        lastReadReportAtMsByChannel,
        nextCursorByChannel,
        hasMoreByChannel,
        loadingMoreMessages,
        sendError,
        composerDraft,
        replyToMessageId,
        selectedDomainId,
      });
    },
  );

  // ============================================================================
  // 频道管理相关方法（拆分到子模块）
  // ============================================================================

  const {
    listMembers,
    kickMember,
    setAdmin,
    removeAdmin,
    listApplications,
    decideApplication,
    listBans,
    setBan,
    removeBan,
    createChannel,
    deleteChannel,
  } = createLiveChatChannelAdminActions({
    api: deps.api,
    getSocketAndValidToken,
    refreshChannels,
    channelsRef,
    currentChannelId,
  });

  return {
    channels,
    allChannels,
    channelSearch,
    channelTab,
    composerDraft,
    selectedDomainId,
    replyToMessageId,
    sendError,
    currentChannelId,
    currentMessages,
    currentChannelHasMore,
    loadingMoreMessages: currentChannelLoadingMore,
    currentChannelLastReadTimeMs,
    members,
    ensureChatReady,
    availableDomains,
    getMessageById,
    selectChannel,
    reportCurrentReadState,
    loadMoreMessages,
    applyJoin,
    updateChannelMeta,
    startReply,
    cancelReply,
    deleteMessage,
    sendComposerMessage,
    // 频道管理
    listMembers,
    kickMember,
    setAdmin,
    removeAdmin,
    listApplications,
    decideApplication,
    listBans,
    setBan,
    removeBan,
    createChannel,
    deleteChannel,
  };
}
