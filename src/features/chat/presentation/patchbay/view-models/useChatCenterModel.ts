/**
 * @fileoverview chat center model
 * @description
 * 收敛 ChatCenter 所需的消息流、连接状态、composer 状态与交互动作，避免布局组件直接依赖多个 store。
 */

import { computed, nextTick, onBeforeUnmount, proxyRefs, ref, watch, type Component, type ComputedRef, type Ref, type ShallowUnwrapRef } from "vue";
import { useI18n } from "vue-i18n";
import { createMessageActionError } from "@/features/chat/message-flow/domain/outcomes/messageActionOutcome";
import { createLogger } from "@/shared/utils/logger";
import { MessagePlugin } from "tdesign-vue-next";
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
import { isMessageAfterReadMarker } from "@/features/chat/presentation/utils/readMarker";
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
  isGroupStart: boolean;
  isUnreadStart: boolean;
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
  searchScope: ComputedRef<"channel" | "server">;
  highlightedMessageId: ComputedRef<string>;
  quoteReplyDraft: ComputedRef<{ messageId: string; userId: string; preview: string } | null>;
  linkPreview: ComputedRef<ChatLinkPreview | null | undefined>;
  fetchLinkPreview: (url: string) => Promise<void>;
  dismissLinkPreview: () => void;
  fmtTime(ms: number): string;
  formatReplyMiniText(channelId: string, replyToId: string): string;
  setDomainId(v: string): void;
  setDraft(v: string): void;
  handleCancelReply(): void;
  handleCancelQuoteReply(): void;
  handleFileUploaded(result: { fileId: string; shareKey: string }): void;
  handleFileUploadError(error: string): void;
  handleSend(payload?: ComposerSubmitPayload): void;
  safeLoadMore(): Promise<void>;
  handleMessageKeydown(e: KeyboardEvent, messageId: string): void;
  handleMentionQuery(query: string): Promise<void>;
  handleSelectMention(mention: { userId: string; displayName: string; type?: "everyone" | "here" }): void;
  handleMentionMenuClose(): void;
  isMentioned(message: ChatMessage): boolean;
  openSearchPanel(): void;
  closeSearchPanel(): void;
  searchMessages(query?: string): Promise<void>;
  setSearchScope(scope: "channel" | "server"): void;
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
  handleBatchDelete(): Promise<void>;
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
  onReplyShortcut(messageId: string): void;
  onDeleteShortcut(messageId: string): void;
  onMessageContextMenu(e: MouseEvent, messageId: string): void;
  onForwardMessage(mid: string, req: { targetCid: string; comment?: string; mergedMids?: string[] }): Promise<void>;
  selectChannel(channelId: string): Promise<void>;
  chatApi?: ChatApiPort;
  linkPreview?: Ref<ChatLinkPreview | null | undefined>;
  fetchLinkPreview?: (url: string) => Promise<void>;
  dismissLinkPreview?: () => void;
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

  const messageRows = computed<MessageRow[]>(() => {
    const list = messageTimelineSnapshot.value.currentMessages;
    const lastReadTime = currentSessionSnapshot.value.lastReadTimeMs;
    const lastReadMid = currentSessionSnapshot.value.lastReadMessageId;
    const rows: MessageRow[] = [];

    for (let idx = 0; idx < list.length; idx += 1) {
      const m = list[idx];
      const prev = idx > 0 ? list[idx - 1] : null;
      const sameSender = prev ? prev.from.id === m.from.id : false;
      const closeInTime = prev ? Math.abs(m.timeMs - prev.timeMs) < 1000 * 90 : false;
      const isGroupStart = !(sameSender && closeInTime);
      const isUnread = isMessageAfterReadMarker(m.timeMs, m.id, lastReadTime, lastReadMid);
      const prevUnread = prev ? isMessageAfterReadMarker(prev.timeMs, prev.id, lastReadTime, lastReadMid) : false;
      rows.push({ m, isGroupStart, isUnreadStart: isUnread && !prevUnread });
    }

    return rows;
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
   */
  const searchPanelOpen = ref(false);
  const searchState = computed(() => messageTimelineSnapshot.value.search);
  const searchScope = computed(() => messageTimelineSnapshot.value.searchScope);
  const highlightedMessageId = computed(() => messageTimelineSnapshot.value.highlightedMessageId);

  function openSearchPanel(): void {
    searchPanelOpen.value = true;
  }

  function closeSearchPanel(): void {
    searchPanelOpen.value = false;
    deps.currentTimeline.clearSearch();
  }

  function setSearchScope(scope: "channel" | "server"): void {
    messageTimelineSnapshot.value.search.searchScope = scope;
    if (scope === "server" && searchState.value.query) {
      void deps.currentTimeline.searchServerMessages(searchState.value.query);
    }
  }

  async function searchMessages(query?: string): Promise<void> {
    const q = (query ?? searchState.value.query ?? "").trim();
    if (!q) return;
    if (messageTimelineSnapshot.value.search.searchScope === "server") {
      await deps.currentTimeline.searchServerMessages(q);
    } else {
      await deps.currentTimeline.searchCurrentChannel(q);
    }
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
        MessagePlugin.success(t("forward_success", { count: ids.length }));
        return;
      } catch (err) {
        clearSelection();
        showForwardDialog.value = false;
        isForwarding.value = false;
        logger.error("Action: chat_forward_message_failed", { mid: ids[0], error: String(err) });
        MessagePlugin.warning(t("forward_failed", { failed: 1, total: ids.length }));
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
      MessagePlugin.warning(t("forward_failed", { failed, total: ids.length }));
    } else {
      MessagePlugin.success(t("forward_success", { count: ids.length - failed }));
    }
  }

  async function handleBatchDelete(): Promise<void> {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    let failed = 0;
    for (const mid of ids) {
      try {
        await deps.currentTimeline.deleteMessage(mid);
      } catch {
        failed++;
      }
    }
    clearSelection();
    if (failed > 0) {
      logger.error("Action: chat_batch_delete_partial_failure", { failed, total: ids.length });
    }
  }

  function handleBatchBookmark(): void {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    const existing: string[] = JSON.parse(localStorage.getItem("cp_bookmarks") ?? "[]");
    const set = new Set([...existing, ...ids]);
    localStorage.setItem("cp_bookmarks", JSON.stringify([...set]));
    clearSelection();
  }

  function fmtTime(ms: number): string {
    return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
    void deps.messageComposer.sendMessage(mergedPayload).then((outcome) => {
      if (outcome.ok) {
        deps.dismissLinkPreview?.();
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

  function handleMessageKeydown(e: KeyboardEvent, messageId: string): void {
    if (e.key === "Delete") {
      e.preventDefault();
      deps.onDeleteShortcut(messageId);
      return;
    }

    const k = e.key.toLowerCase();
    if (!e.metaKey && !e.ctrlKey && !e.altKey && k === "r") {
      e.preventDefault();
      deps.onReplyShortcut(messageId);
      return;
    }

    const openContext = (e.shiftKey && e.key === "F10") || e.key === "ContextMenu";
    if (!openContext) return;

    e.preventDefault();
    const target = e.currentTarget as HTMLElement | null;
    const rect = target?.getBoundingClientRect();
    const x = Math.trunc((rect?.left ?? 0) + 20);
    const y = Math.trunc((rect?.top ?? 0) + 20);
    deps.onMessageContextMenu(new MouseEvent("contextmenu", { bubbles: true, clientX: x, clientY: y }), messageId);
  }

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
    searchScope,
    highlightedMessageId,
    quoteReplyDraft,
    linkPreview,
    fetchLinkPreview,
    dismissLinkPreview,
    fmtTime,
    formatReplyMiniText,
    setDomainId,
    setDraft,
    handleCancelReply,
    handleCancelQuoteReply,
    handleFileUploaded,
    handleFileUploadError,
    handleSend,
    safeLoadMore,
    handleMessageKeydown,
    handleMentionQuery,
    handleSelectMention,
    handleMentionMenuClose,
    isMentioned,
    openSearchPanel,
    closeSearchPanel,
    searchMessages,
    setSearchScope,
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
    handleBatchDelete,
    handleBatchBookmark,
    toggleMessageSelection: (id: string) => toggleMessageSelection(id),
    isMessageSelected: (id: string) => isMessageSelected(id),
  };
  return proxyRefs(rawModel);
}
