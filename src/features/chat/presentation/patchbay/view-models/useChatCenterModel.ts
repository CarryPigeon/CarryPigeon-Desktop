/**
 * @fileoverview chat center model
 * @description
 * 收敛 ChatCenter 所需的消息流、连接状态、composer 状态与交互动作，避免布局组件直接依赖多个 store。
 */

import { computed, nextTick, onBeforeUnmount, proxyRefs, ref, watch, type Component, type ComputedRef, type Ref, type ShallowUnwrapRef } from "vue";
import { useI18n } from "vue-i18n";
import { createMessageActionError } from "@/features/chat/message-flow/domain/outcomes/messageActionOutcome";
import { createLogger } from "@/shared/utils/logger";
import { toast } from "@/shared/utils/toast";
import type {
  ChannelMessageLookupCapabilities,
  ChatMessage,
  ComposerSubmitPayload,
  MentionCandidate,
  MessageComposerCapabilities,
  MessageComposerSnapshot,
  MessageSearchState,
  MessageTimelineCapabilities,
  MessageTimelineSnapshot,
} from "@/features/chat/message-flow/api-types";
import type {
  CurrentChannelSessionCapabilities,
  CurrentChannelSessionSnapshot,
} from "@/features/chat/room-session/api-types";
import type { ServerWorkspaceConnectionOutcome } from "@/features/server-connection/api-types";
import { formatGroupHeadTime, projectMessageRows } from "./messageRowProjection";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";
import {
  multiSelectMode as storeMultiSelectMode,
  isMessageSelected,
  toggleMessageSelection,
  clearSelection,
  getSelectedCount,
  getSelectedIds,
} from "@/features/chat/message-flow/presentation/store-access/messageFlowStoreAccess";
import type { ChatLinkPreview } from "@/features/chat/domain/types/chatApiModels";
import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { PinSummary } from "@/features/chat/presentation/patchbay/components/layout/PinListBar.vue";
import {
  collectUnresolvedForwardAuthorUids,
  withResolvedForwardAuthorNames,
} from "./forwardAuthorNames";
import {
  collectUnresolvedAuthorUids,
  withResolvedMentionNames,
  withResolvedQuoteReplyName,
  withResolvedSenderName,
} from "./authorNameResolution";
import { normalizeUserId } from "@/features/chat/shared-kernel/userId";
import { addBookmarks } from "@/features/chat/message-flow/bookmark/storage/localBookmarkStorage";

type RefLike<T> = Ref<T> | ComputedRef<T>;
type ChatConnectionPillStateView = "connected" | "reconnecting" | "offline";

const logger = createLogger("chat-center-model");

/**
 * ChatCenter 需要的最小 domain registry 视图。
 */
export type DomainRegistryStoreLike = {
  getBinding(domainId: string): {
    pluginId: string;
    composer?: Component | null;
    renderer?: unknown;
  } | null;
  getContextForPlugin(pluginId: string): unknown;
  getContextForDomain(domainId: string): unknown;
};

/**
 * 聊天消息列表行投影。
 */
export type MessageRow = {
  m: ChatMessage;
  /** 是否为分组首条（仅组首渲染名字 / 头像 / 时间戳）。 */
  isGroupStart: boolean;
  isUnreadStart: boolean;
  /** 组首时间戳是否需要带日期前缀（跨自然日时为 `true`）。 */
  showDate: boolean;
};

type ChatCenterRawModel = {
  connectionDetail: ComputedRef<string>;
  connectionPillState: ComputedRef<ChatConnectionPillStateView>;
  retryConnection(): Promise<ServerWorkspaceConnectionOutcome>;
  currentChannelId: ComputedRef<CurrentChannelSessionSnapshot["currentChannelId"]>;
  currentChannelName: ComputedRef<string>;
  currentChannelHasMore: ComputedRef<MessageTimelineSnapshot["hasMoreHistory"]>;
  loadingMoreMessages: ComputedRef<MessageTimelineSnapshot["isLoadingHistory"]>;
  messageRows: ComputedRef<MessageRow[]>;
  currentUserId: ComputedRef<string>;
  selectedDomainId: ComputedRef<MessageComposerSnapshot["activeDomainId"]>;
  composerDraft: ComputedRef<MessageComposerSnapshot["draft"]>;
  replyToMessageId: ComputedRef<MessageComposerSnapshot["replyToMessageId"]>;
  messageActionError: ComputedRef<string>;
  domainOptions: ComputedRef<Array<{ id: string; label: string; colorVar: ChatMessage["domain"]["colorVar"] }>>;
  replyPreview: ComputedRef<{ title: string; snippet: string }>;
  activePluginComposer: ComputedRef<Component | null>;
  activePluginContext: ComputedRef<unknown>;
  domainRegistryStore: ComputedRef<DomainRegistryStoreLike>;
  mentionCandidates: Ref<MentionCandidate[]>;
  mentionMenuOpen: Ref<boolean>;
  currentUserRole: ComputedRef<string>;
  searchPanelOpen: Ref<boolean>;
  searchState: ComputedRef<MessageSearchState>;
  highlightedMessageId: ComputedRef<string>;
  /** 置顶消息摘要列表。 */
  pins: Ref<PinSummary[]>;
  /** 是否正在加载置顶消息。 */
  pinsLoading: Ref<boolean>;
  /** 加载置顶消息时的错误信息。 */
  pinsError: Ref<string | null>;
  /** 置顶栏是否已被用户关闭。 */
  pinsDismissed: Ref<boolean>;
  /** 加载当前频道的置顶消息。 */
  loadPins(): Promise<void>;
  /** 关闭置顶栏。 */
  dismissPins(): void;
  /** 选中某条置顶消息，跳转到其位置。 */
  selectPinnedMessage(messageId: string): Promise<void>;
  /** 取消某条消息的置顶。 */
  unpinFromBar(messageId: string): Promise<void>;
  quoteReplyDraft: ComputedRef<{ messageId: string; userId: string; preview: string } | null>;
  linkPreview: ComputedRef<ChatLinkPreview | null | undefined>;
  fetchLinkPreview: (url: string) => Promise<void>;
  dismissLinkPreview: () => void;
  fmtTime(ms: number): string;
  /**
   * 格式化分组首条的时间戳：跨自然日时带 `MM-DD` 前缀。
   */
  fmtGroupHeadTime(ms: number, showDate: boolean): string;
  formatReplyMiniText(channelId: string, replyToId: string): string;
  setDomainId(v: string): void;
  setDraft(v: string): void;
  handleCancelReply(): void;
  handleCancelQuoteReply(): void;
  handleFileUploaded(result: { fileId: string; shareKey: string }): void;
  handleFileUploadError(error: string): void;
  handleSend(payload?: ComposerSubmitPayload): void;
  safeLoadMore(): Promise<void>;
  handleMentionQuery(query: string): Promise<void>;
  handleSelectMention(mention: { userId: string; displayName: string; type?: "everyone" | "here" }): void;
  handleMentionMenuClose(): void;
  isMentioned(message: ChatMessage): boolean;
  openSearchPanel(): void;
  closeSearchPanel(): void;
  searchMessages(query?: string): Promise<void>;
  openSearchResult(messageId: string, channelId?: string): Promise<void>;
  multiSelectMode: ComputedRef<boolean>;
  selectedCount: ComputedRef<number>;
  enterMultiSelectMode(firstMessageId: string): void;
  handleCancelMultiSelect(): void;
  handleBatchForwardMerged(): void;
  handleBatchForwardSeparate(): void;
  handleSingleForward(messageId: string): void;
  showForwardDialog: Ref<boolean>;
  forwardMode: Ref<"merged" | "separate">;
  forwardMessageCount: ComputedRef<number>;
  isForwarding: Ref<boolean>;
  closeForwardDialog(): void;
  handleForwardConfirm(payload: { targetCid: string; comment: string }): Promise<void>;
  handleBatchBookmark(): void;
  toggleMessageSelection(id: string): void;
  isMessageSelected(id: string): boolean;
};
/**
 * ChatCenter 组件消费的页面模型。
 */
export type ChatCenterModel = ShallowUnwrapRef<ChatCenterRawModel>;

/**
 * ChatCenter 页面模型依赖。
 */
export type UseChatCenterModelDeps = {
  currentSession: CurrentChannelSessionCapabilities;
  currentTimeline: MessageTimelineCapabilities;
  messageComposer: MessageComposerCapabilities;
  lookupChannel(channelId: string): ChannelMessageLookupCapabilities;
  currentUserId: RefLike<string>;
  currentUserRole: RefLike<string>;
  currentChannelName: RefLike<string>;
  connectionDetail: RefLike<string>;
  connectionPillState: RefLike<ChatConnectionPillStateView>;
  retryConnection(): Promise<ServerWorkspaceConnectionOutcome>;
  domainRegistryView: RefLike<unknown>;
  onLoadMoreMessages(): void | Promise<void>;
  onMessageContextMenu(e: MouseEvent, messageId: string): void;
  onForwardMessage(mid: string, req: { targetCid: string; comment?: string; mergedMids?: string[] }): Promise<void>;
  selectChannel(channelId: string): Promise<void>;
  chatApi?: ChatApiPort;
  /** 当前服务器 socket（用于 API 调用）。 */
  serverSocket?: RefLike<string>;
  /** 获取有效 access token。 */
  getAccessToken?: (socket: string) => Promise<string | undefined>;
  linkPreview?: Ref<ChatLinkPreview | null | undefined>;
  fetchLinkPreview?: (url: string) => Promise<void>;
  dismissLinkPreview?: () => void;
  /**
   * 成员名解析兜底：消息发送者名缺失（形如 `u:123` / `用户 123`）时按 uid 查成员昵称。
   *
   * 说明：可选；未提供时保持消息原始发送者名。
   */
  resolveSenderName?: (uid: string) => string;
  /**
   * 批量补拉用户昵称（转发条目作者可能不在当前频道成员目录内）。
   *
   * 说明：可选；入参为去重后的 uid 列表，返回 uid → nickname 映射（缺失项可省略）。
   */
  fetchUserNames?: (uids: string[]) => Promise<Record<string, string>>;
  /**
   * 自己发送消息成功后的通知（用于消息面板自动跳到底部）。
   *
   * 说明：可选；仅在发送结果确认成功且用户仍停留在发送时频道后调用。
   */
  onOwnMessageSent?: () => void;
};

/**
 * 创建 ChatCenter 页面模型。
 *
 * 该模型把 capability 快照、插件域投影与局部交互动作收敛为模板友好的单一视图。
 */
export function useChatCenterModel(deps: UseChatCenterModelDeps): ChatCenterModel {
  const { t } = useI18n();
  const currentSessionSnapshot = useObservedCapabilitySnapshot(deps.currentSession);
  const messageTimelineSnapshot = useObservedCapabilitySnapshot(deps.currentTimeline);
  const messageComposerSnapshot = useObservedCapabilitySnapshot(deps.messageComposer);
  const domainRegistryStore = computed<DomainRegistryStoreLike>(() => deps.domainRegistryView.value as DomainRegistryStoreLike);

  const activePluginComposer = computed(() => {
    const store = domainRegistryStore.value;
    return store?.getBinding(messageComposerSnapshot.value.activeDomainId)?.composer ?? null;
  });

  const activePluginContext = computed(() => {
    const store = domainRegistryStore.value;
    const binding = store?.getBinding(messageComposerSnapshot.value.activeDomainId) ?? null;
    if (!binding) return null;
    return store.getContextForPlugin(binding.pluginId);
  });

  const domainOptions = computed<Array<{ id: string; label: string; colorVar: ChatMessage["domain"]["colorVar"] }>>(() => {
    const out: Array<{ id: string; label: string; colorVar: ChatMessage["domain"]["colorVar"] }> = [];
    for (const d of messageComposerSnapshot.value.availableDomains) out.push({ id: d.id, label: d.label, colorVar: d.colorVar });
    return out;
  });

  /** 已补拉的用户公开资料昵称缓存（归一化 uid → nickname）；重赋值新 Map 以触发响应式更新。 */
  const fetchedUserNames = ref(new Map<string, string>());
  /** 每个 uid 已发起的补拉次数（归一化 uid → attempts），用于去重与防止无限重试。 */
  const profileFetchAttempts = new Map<string, number>();
  /** 待补拉 uid 累积队列（debounce 合并成单次批量请求）。 */
  const pendingFetchUids: string[] = [];
  let profileFetchTimer: ReturnType<typeof setTimeout> | null = null;
  /** 队列中最早一次入队时间（毫秒），用于避免持续变化把 debounce 一直往后推。 */
  let pendingFetchSince: number | null = null;

  /** 单个 uid 的补拉次数上限：允许「连接/鉴权尚未就绪」后重试，但不会随投影变化无限放大请求。 */
  const MAX_PROFILE_FETCH_ATTEMPTS = 2;
  /** 批量补拉的 debounce 窗口（毫秒）。 */
  const PROFILE_FETCH_DEBOUNCE_MS = 200;
  /** 队列最长等待时间（毫秒）：持续有 uid 入队时也要强制冲刷一次。 */
  const PROFILE_FETCH_MAX_WAIT_MS = 1000;

  /**
   * 作者名解析：频道成员目录 → 已补拉用户公开资料缓存。
   *
   * @param uid - 发送者 / 提及目标 / 转发条目作者的用户 id。
   * @returns 解析出的昵称；不可解析时返回空串。
   */
  function resolveAuthorName(uid: string): string {
    const memberName = deps.resolveSenderName?.(uid)?.trim() ?? "";
    if (memberName) return memberName;
    return fetchedUserNames.value.get(normalizeUserId(uid)) ?? "";
  }

  /**
   * 调度补拉缺失昵称的用户：去重、debounce 合并为一次批量请求（`GET /users?ids=`）。
   *
   * 说明：
   * - 每个 uid 最多尝试 {@link MAX_PROFILE_FETCH_ATTEMPTS} 次，避免「服务端解析不出昵称」的 uid
   *   随消息列表频繁变化被反复请求；
   * - 队列最早入队的 uid 等待超过 {@link PROFILE_FETCH_MAX_WAIT_MS} 时立即冲刷，避免持续变化饿死。
   *
   * @param uids - 需要补拉昵称的 uid 列表。
   */
  function scheduleUserProfileFetch(uids: string[]): void {
    const fetchNames = deps.fetchUserNames;
    if (!fetchNames) return;
    const fresh = uids.filter((uid) => {
      const key = normalizeUserId(uid);
      return Boolean(key) && (profileFetchAttempts.get(key) ?? 0) < MAX_PROFILE_FETCH_ATTEMPTS;
    });
    if (fresh.length === 0) return;
    for (const uid of fresh) {
      const key = normalizeUserId(uid);
      profileFetchAttempts.set(key, (profileFetchAttempts.get(key) ?? 0) + 1);
    }
    pendingFetchUids.push(...fresh);
    const now = Date.now();
    if (pendingFetchSince == null) pendingFetchSince = now;
    const waitedMs = now - pendingFetchSince;
    const delayMs = waitedMs >= PROFILE_FETCH_MAX_WAIT_MS ? 0 : PROFILE_FETCH_DEBOUNCE_MS;
    if (profileFetchTimer) clearTimeout(profileFetchTimer);
    profileFetchTimer = setTimeout(() => {
      profileFetchTimer = null;
      pendingFetchSince = null;
      const batch = [...new Set(pendingFetchUids.splice(0))];
      if (batch.length === 0) return;
      // 包一层 Promise：fetchNames 同步抛错时也能走 catch，而不是逃逸出 setTimeout 回调。
      void Promise.resolve()
        .then(() => fetchNames(batch))
        .then((names) => {
          const next = fetchedUserNames.value;
          let mutated = false;
          for (const [uid, name] of Object.entries(names ?? {})) {
            const key = normalizeUserId(uid);
            const trimmed = String(name ?? "").trim();
            if (!key || !trimmed || next.has(key)) continue;
            next.set(key, trimmed);
            mutated = true;
          }
          if (mutated) fetchedUserNames.value = new Map(next);
        })
        .catch((err) => {
          logger.warn("Action: chat_message_author_profile_batch_failed", { count: batch.length, error: String(err) });
        });
    }, delayMs);
  }

  /**
   * 统一作者名投影：发送者 → 提及目标 → 内联引用作者 → 转发条目作者。
   *
   * @param message - 原始消息（store 内对象，不被改写）。
   * @returns 作者名已解析（或无需解析）的消息。
   */
  function withResolvedAuthorNames(message: ChatMessage): ChatMessage {
    return withResolvedForwardAuthorNames(
      withResolvedQuoteReplyName(
        withResolvedMentionNames(withResolvedSenderName(message, resolveAuthorName), resolveAuthorName),
        resolveAuthorName,
      ),
      resolveAuthorName,
    );
  }

  const messageRows = computed<MessageRow[]>(() => {
    const list = messageTimelineSnapshot.value.currentMessages;
    const lastReadTime = currentSessionSnapshot.value.lastReadTimeMs;
    const lastReadMid = currentSessionSnapshot.value.lastReadMessageId;
    const projections = projectMessageRows(list, {
      lastReadTimeMs: lastReadTime,
      lastReadMessageId: lastReadMid,
    });

    return list.map((raw, idx) => ({
      m: withResolvedAuthorNames(raw),
      isGroupStart: projections[idx].isGroupStart,
      isUnreadStart: projections[idx].isUnreadStart,
      showDate: projections[idx].showDate,
    }));
  });

  const replyPreview = computed<{ title: string; snippet: string }>(() => {
    const draft = messageComposerSnapshot.value.replyDraft;
    if (!draft) return { title: "", snippet: "" };
    return {
      title: `Replying to ${draft.senderName}`,
      snippet: draft.preview,
    };
  });

  const quoteReplyDraft = computed(() => messageComposerSnapshot.value.quoteReplyDraft);

  const linkPreview = computed(() => deps.linkPreview?.value);

  function dismissLinkPreview(): void {
    deps.dismissLinkPreview?.();
  }

  async function fetchLinkPreview(url: string): Promise<void> {
    await deps.fetchLinkPreview?.(url);
  }

  const currentUserId = computed(() => deps.currentUserId.value || "u-1");
  const currentUserRole = computed(() => deps.currentUserRole.value);

  /**
   * 提及候选状态。
   */
  const mentionCandidates = ref<MentionCandidate[]>([]);
  const mentionMenuOpen = ref(false);

  /**
   * 根据当前输入查询匹配的提及候选列表。
   */
  async function handleMentionQuery(query: string): Promise<void> {
    const all = await deps.messageComposer.listMentionCandidates(deps.currentSession.getSnapshot().currentChannelId);
    const normalized = query.trim().toLowerCase();
    mentionCandidates.value = normalized
      ? all.filter((candidate) => candidate.displayName.toLowerCase().includes(normalized))
      : all;
    mentionMenuOpen.value = mentionCandidates.value.length > 0;
  }

  /**
   * 选中一个提及候选项。
   */
  function handleSelectMention(mention: { userId: string; displayName: string; type?: "everyone" | "here" }): void {
    deps.messageComposer.addMention?.(mention);
    mentionMenuOpen.value = false;
  }

  /**
   * 关闭提及菜单。
   */
  function handleMentionMenuClose(): void {
    mentionMenuOpen.value = false;
  }

  /**
   * 判断消息是否提及了当前用户。
   */
  function isMentioned(message: ChatMessage): boolean {
    return Boolean(message.mentions?.some((mention) => mention.userId === currentUserId.value));
  }

  /**
   * 搜索面板状态。
   *
   * 搜索结果同样按 uid 解析作者昵称：服务端信封不带昵称时，避免结果行回退成「用户 <uid>」。
   */
  const searchPanelOpen = ref(false);
  const searchState = computed<MessageSearchState>(() => {
    const state = messageTimelineSnapshot.value.search;
    if (state.results.length === 0) return state;
    return {
      ...state,
      results: state.results.map((result) => ({
        ...result,
        message: withResolvedAuthorNames(result.message),
      })),
    };
  });
  const highlightedMessageId = computed(() => messageTimelineSnapshot.value.highlightedMessageId);

  // 作者名补拉调度：行投影/搜索结果变化后收集仍缺失昵称的发送者/提及/转发作者，debounce 批量请求。
  watch([messageRows, searchState], ([rows, search]) => {
    const messages = [
      ...rows.map((row) => row.m),
      ...search.results.map((result) => result.message),
    ];
    const hasName = (uid: string): boolean => Boolean(resolveAuthorName(uid));
    const missing = [
      ...collectUnresolvedAuthorUids(messages, hasName),
      ...collectUnresolvedForwardAuthorUids(messages, hasName),
    ];
    if (missing.length > 0) scheduleUserProfileFetch(missing);
  }, { immediate: true });

  /**
   * Pin state.
   */
  const pins = ref<PinSummary[]>([]);
  const pinsLoading = ref(false);
  const pinsError = ref<string | null>(null);
  const pinsDismissed = ref(false);

  /** Reset pin state when channel changes. */
  watch(() => currentSessionSnapshot.value.currentChannelId, () => {
    pins.value = [];
    pinsLoading.value = false;
    pinsError.value = null;
    pinsDismissed.value = false;
  });

  /**
   * Load pins for the current channel.
   */
  async function loadPins(): Promise<void> {
    const cid = currentSessionSnapshot.value.currentChannelId;
    if (!cid) return;
    const api = deps.chatApi;
    const socket = deps.serverSocket?.value;
    if (!api || !socket || !deps.getAccessToken) return;
    pinsLoading.value = true;
    pinsError.value = null;
    try {
      const token = (await deps.getAccessToken(socket))?.trim();
      if (!token) {
        pinsLoading.value = false;
        return;
      }
      const result = await api.listPins(socket, token, cid);
      const summaries: PinSummary[] = result.items.map((pin) => ({
        pin,
        preview: pin.note ?? `Message ${pin.messageId.slice(-8)}`,
        pinnedByName: pin.pinnedByUserId ? `u:${pin.pinnedByUserId.slice(-6)}` : t("unknown"),
        senderName: "—",
        senderId: undefined,
      }));
      pins.value = summaries;
      pinsDismissed.value = false;
    } catch (err) {
      pinsError.value = String(err);
      logger.error("Action: chat_load_pins_failed", { channelId: cid, error: String(err) });
    } finally {
      pinsLoading.value = false;
    }
  }

  function dismissPins(): void {
    pinsDismissed.value = true;
    pins.value = [];
  }

  async function selectPinnedMessage(messageId: string): Promise<void> {
    await deps.currentTimeline.loadContextAroundMessage(messageId);
    await nextTick();
    const el = document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (el) el.scrollIntoView({ block: "center" });
  }

  async function unpinFromBar(messageId: string): Promise<void> {
    const cid = currentSessionSnapshot.value.currentChannelId;
    if (!cid) return;
    const api = deps.chatApi;
    const socket = deps.serverSocket?.value;
    if (!api || !socket || !deps.getAccessToken) return;
    try {
      const token = (await deps.getAccessToken(socket))?.trim();
      if (!token) return;
      await api.unpinMessage(socket, token, cid, messageId);
      pins.value = pins.value.filter((p) => p.pin.messageId !== messageId);
      toast.success(t("unpin_message"));
    } catch (err) {
      logger.error("Action: chat_unpin_message_failed", { messageId, error: String(err) });
      toast.warning(t("unpin_failed"));
    }
  }

  function openSearchPanel(): void {
    searchPanelOpen.value = true;
  }

  function closeSearchPanel(): void {
    searchPanelOpen.value = false;
    deps.currentTimeline.clearSearch();
  }

  async function searchMessages(query?: string): Promise<void> {
    const q = (query ?? searchState.value.query ?? "").trim();
    if (!q) return;
    await deps.currentTimeline.searchCurrentChannel(q);
  }

  async function openSearchResult(messageId: string, channelId?: string): Promise<void> {
    if (channelId && channelId !== currentSessionSnapshot.value.currentChannelId) {
      await deps.selectChannel(channelId);
    }
    await deps.currentTimeline.loadContextAroundMessage(messageId);
    await nextTick();
    const el = document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (el) el.scrollIntoView({ block: "center" });
  }

  /**
   * Multi-select mode.
   */
  const multiSelectMode = computed({
    get: () => storeMultiSelectMode.value,
    set: (v: boolean) => { storeMultiSelectMode.value = v; },
  });

  const selectedCount = computed(() => getSelectedCount());

  function enterMultiSelectMode(firstMessageId: string): void {
    storeMultiSelectMode.value = true;
    toggleMessageSelection(firstMessageId);
  }

  function handleCancelMultiSelect(): void {
    clearSelection();
  }

  // Forward dialog state
  const showForwardDialog = ref(false);
  const forwardMode = ref<"merged" | "separate">("separate");
  const pendingForwardIds = ref<string[]>([]);
  const forwardMessageCount = computed(() => pendingForwardIds.value.length);
  const isForwarding = ref(false);

  function handleBatchForwardMerged(): void {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    pendingForwardIds.value = [...ids];
    forwardMode.value = "merged";
    showForwardDialog.value = true;
  }

  function handleBatchForwardSeparate(): void {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    pendingForwardIds.value = [...ids];
    forwardMode.value = "separate";
    showForwardDialog.value = true;
  }

  function handleSingleForward(messageId: string): void {
    pendingForwardIds.value = [messageId];
    forwardMode.value = "separate";
    showForwardDialog.value = true;
  }

  function closeForwardDialog(): void {
    showForwardDialog.value = false;
    isForwarding.value = false;
  }

  async function handleForwardConfirm(payload: { targetCid: string; comment: string }): Promise<void> {
    const ids = pendingForwardIds.value;
    if (ids.length === 0) return;
    if (isForwarding.value) return;

    isForwarding.value = true;

    if (forwardMode.value === "merged") {
      try {
        await deps.onForwardMessage(ids[0], {
          targetCid: payload.targetCid,
          comment: payload.comment || undefined,
          mergedMids: ids,
        });
        clearSelection();
        showForwardDialog.value = false;
        isForwarding.value = false;
        toast.success(t("forward_success", { count: ids.length }));
        return;
      } catch (err) {
        clearSelection();
        showForwardDialog.value = false;
        isForwarding.value = false;
        logger.error("Action: chat_forward_message_failed", { mid: ids[0], error: String(err) });
        toast.warning(t("forward_failed", { failed: 1, total: ids.length }));
        return;
      }
    }

    let failed = 0;
    for (const mid of ids) {
      try {
        await deps.onForwardMessage(mid, {
          targetCid: payload.targetCid,
          comment: payload.comment || undefined,
        });
      } catch (err) {
        failed++;
        logger.error("Action: chat_forward_message_failed", { mid, error: String(err) });
      }
    }

    clearSelection();
    showForwardDialog.value = false;
    isForwarding.value = false;

    if (failed > 0) {
      toast.warning(t("forward_failed", { failed, total: ids.length }));
    } else {
      toast.success(t("forward_success", { count: ids.length - failed }));
    }
  }

  function handleBatchBookmark(): void {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    const cid = currentSessionSnapshot.value.currentChannelId;
    const channelName = String(deps.currentChannelName.value ?? "");
    const lookup = cid ? deps.lookupChannel(cid) : null;
    // 收藏存的是展示快照：优先使用行投影里已按 uid 解析出的昵称，避免落入「用户 <uid>」占位名。
    const resolvedSenderNames = new Map(messageRows.value.map((row) => [row.m.id, row.m.from.name]));
    addBookmarks(
      ids.map((messageId) => {
        const msg = lookup?.findMessageById(messageId);
        return {
          messageId,
          channelId: cid ?? "",
          channelName,
          contentPreview: msg ? (msg.kind === "core_text" ? msg.text : msg.preview) : "",
          senderName: resolvedSenderNames.get(messageId) || msg?.from?.name || "",
          bookmarkedAt: Date.now(),
        };
      }),
    );
    clearSelection();
  }

  function fmtTime(ms: number): string {
    return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  /**
   * 格式化分组首条的时间戳。
   *
   * @param ms - 消息时间戳。
   * @param showDate - 是否带 `MM-DD` 日期前缀（跨自然日的组首）。
   * @returns `HH:MM` 或 `MM-DD HH:MM`。
   */
  function fmtGroupHeadTime(ms: number, showDate: boolean): string {
    return formatGroupHeadTime(ms, showDate);
  }

  function formatReplyMiniText(channelId: string, replyToId: string): string {
    const r = deps.lookupChannel(channelId).findMessageById(replyToId);
    if (!r) return "—";
    const snippet = r.kind === "core_text" ? r.text : r.preview;
    return `${r.from.name}: ${snippet}`;
  }

  function setDomainId(v: string): void {
    deps.messageComposer.setActiveDomainId(v);
  }

  let draftDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  const DEBOUNCE_MS = 1000;

  function setDraft(v: string): void {
    deps.messageComposer.setDraft(v);
    if (draftDebounceTimer) clearTimeout(draftDebounceTimer);
    const capturedCid = currentSessionSnapshot.value.currentChannelId;
    draftDebounceTimer = setTimeout(() => {
      if (capturedCid) deps.messageComposer.saveChannelDraft(capturedCid, v);
    }, DEBOUNCE_MS);
  }

  onBeforeUnmount(() => {
    if (draftDebounceTimer) clearTimeout(draftDebounceTimer);
    if (profileFetchTimer) clearTimeout(profileFetchTimer);
  });

  function handleCancelReply(): void {
    deps.messageComposer.cancelReply();
  }

  function handleCancelQuoteReply(): void {
    deps.messageComposer.cancelQuoteReply();
  }

  function handleFileUploaded(result: { fileId: string; shareKey: string }): void {
    deps.messageComposer.appendAttachmentShareKey(result.shareKey);
  }

  function handleFileUploadError(error: string): void {
    deps.messageComposer.setActionError(
      createMessageActionError("send_failed", "Send failed.", error),
    );
  }

  function handleSend(payload?: ComposerSubmitPayload): void {
    if (draftDebounceTimer) clearTimeout(draftDebounceTimer);
    const lp = linkPreview.value;
    const mergedPayload: ComposerSubmitPayload | undefined = payload
      ? { ...payload, ...(lp ? { linkPreview: lp } : {}) }
      : lp
        // For Core:Text sends, pass a lightweight payload that carries only
        // the linkPreview. sendComposerMessage detects this via hasRealPayload
        // and still reads domain/version/data from composer state (so pending
        // attachment share-keys appended to the draft are not lost).
        ? { domain: "", domainVersion: "", data: undefined, linkPreview: lp }
        : undefined;
    // 记录发送时所在频道：发送期间用户可能切换频道，此时不应触发跳底。
    const sentFromCid = currentSessionSnapshot.value.currentChannelId;
    void deps.messageComposer.sendMessage(mergedPayload).then((outcome) => {
      if (outcome.ok) {
        deps.dismissLinkPreview?.();
        // 自己发送的消息：若仍停留在发送时的频道，则通知视口自动跳到最底部。
        if (currentSessionSnapshot.value.currentChannelId === sentFromCid) {
          deps.onOwnMessageSent?.();
        }
        return;
      }
      deps.messageComposer.setActionError(outcome.error);
    });
  }

  async function safeLoadMore(): Promise<void> {
    await deps.onLoadMoreMessages();
  }

  /**
   * 在频道切换时保存当前频道的草稿并恢复目标频道的草稿。
   * immediate: true 确保首次加载时恢复初始频道的草稿。
   */
  watch(() => currentSessionSnapshot.value.currentChannelId, (newCid, oldCid) => {
    if (draftDebounceTimer) clearTimeout(draftDebounceTimer);
    if (oldCid && oldCid !== newCid) {
      const currentDraft = messageComposerSnapshot.value.draft;
      if (currentDraft.trim()) {
        deps.messageComposer.saveChannelDraft(oldCid, currentDraft);
      } else {
        deps.messageComposer.clearChannelDraft(oldCid);
      }
    }
    const restored = deps.messageComposer.readChannelDraft(newCid);
    deps.messageComposer.setDraft(restored);
  }, { immediate: true });

  const rawModel: ChatCenterRawModel = {
    connectionDetail: computed(() => deps.connectionDetail.value),
    connectionPillState: computed(() => deps.connectionPillState.value),
    retryConnection: deps.retryConnection,
    currentChannelId: computed(() => currentSessionSnapshot.value.currentChannelId),
    currentChannelName: computed(() => deps.currentChannelName.value),
    currentChannelHasMore: computed(() => messageTimelineSnapshot.value.hasMoreHistory),
    loadingMoreMessages: computed(() => messageTimelineSnapshot.value.isLoadingHistory),
    messageRows,
    currentUserId,
    selectedDomainId: computed(() => messageComposerSnapshot.value.activeDomainId),
    composerDraft: computed(() => messageComposerSnapshot.value.draft),
    replyToMessageId: computed(() => messageComposerSnapshot.value.replyToMessageId),
    messageActionError: computed(() => messageComposerSnapshot.value.actionError?.message ?? ""),
    domainOptions,
    replyPreview,
    activePluginComposer,
    activePluginContext,
    domainRegistryStore,
    mentionCandidates,
    mentionMenuOpen,
    currentUserRole,
    searchPanelOpen,
    searchState,
    highlightedMessageId,
    pins,
    pinsLoading,
    pinsError,
    pinsDismissed,
    loadPins,
    dismissPins,
    selectPinnedMessage,
    unpinFromBar,
    quoteReplyDraft,
    linkPreview,
    fetchLinkPreview,
    dismissLinkPreview,
    fmtTime,
    fmtGroupHeadTime,
    formatReplyMiniText,
    setDomainId,
    setDraft,
    handleCancelReply,
    handleCancelQuoteReply,
    handleFileUploaded,
    handleFileUploadError,
    handleSend,
    safeLoadMore,
    handleMentionQuery,
    handleSelectMention,
    handleMentionMenuClose,
    isMentioned,
    openSearchPanel,
    closeSearchPanel,
    searchMessages,
    openSearchResult,
    multiSelectMode,
    selectedCount,
    enterMultiSelectMode,
    handleCancelMultiSelect,
    handleBatchForwardMerged,
    handleBatchForwardSeparate,
    handleSingleForward,
    showForwardDialog,
    forwardMode,
    forwardMessageCount,
    isForwarding,
    closeForwardDialog,
    handleForwardConfirm,
    handleBatchBookmark,
    toggleMessageSelection: (id: string) => toggleMessageSelection(id),
    isMessageSelected: (id: string) => isMessageSelected(id),
  };
  return proxyRefs(rawModel);
}
