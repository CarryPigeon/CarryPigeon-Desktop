/**
 * @fileoverview chat center model
 * @description
 * 收敛 ChatCenter 所需的消息流、连接状态、composer 状态与交互动作，避免布局组件直接依赖多个 store。
 */

import { computed, proxyRefs, type Component, type ComputedRef, type Ref, type ShallowUnwrapRef } from "vue";
import { createMessageActionError } from "@/features/chat/message-flow/domain/outcomes/messageActionOutcome";
import type {
  ChannelMessageLookupCapabilities,
  ChatMessage,
  ComposerSubmitPayload,
  MessageComposerCapabilities,
  MessageComposerSnapshot,
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

type RefLike<T> = Ref<T> | ComputedRef<T>;
type ChatConnectionPillStateView = "connected" | "reconnecting" | "offline";

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
  fmtTime(ms: number): string;
  formatReplyMiniText(channelId: string, replyToId: string): string;
  setDomainId(v: string): void;
  setDraft(v: string): void;
  handleCancelReply(): void;
  handleFileUploaded(result: { fileId: string; shareKey: string }): void;
  handleFileUploadError(error: string): void;
  handleSend(payload?: ComposerSubmitPayload): void;
  safeLoadMore(): Promise<void>;
  handleMessageKeydown(e: KeyboardEvent, messageId: string): void;
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
  connectionDetail: RefLike<string>;
  connectionPillState: RefLike<ChatConnectionPillStateView>;
  retryConnection(): Promise<ServerWorkspaceConnectionOutcome>;
  domainRegistryView: RefLike<unknown>;
  onLoadMoreMessages(): void | Promise<void>;
  onReplyShortcut(messageId: string): void;
  onDeleteShortcut(messageId: string): void;
  onMessageContextMenu(e: MouseEvent, messageId: string): void;
};

/**
 * 创建 ChatCenter 页面模型。
 *
 * 该模型把 capability 快照、插件域投影与局部交互动作收敛为模板友好的单一视图。
 */
export function useChatCenterModel(deps: UseChatCenterModelDeps): ChatCenterModel {
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

  function findCurrentTimelineMessage(messageId: string): ChatMessage | null {
    for (const message of messageTimelineSnapshot.value.currentMessages) {
      if (message.id === messageId) return message;
    }
    return null;
  }

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
    const id = messageComposerSnapshot.value.replyToMessageId;
    if (!id) return { title: "", snippet: "" };
    const msg = findCurrentTimelineMessage(id);
    if (!msg) return { title: "Reply", snippet: "Message not found" };
    const snippet = msg.kind === "core_text" ? msg.text : msg.preview;
    return { title: `Reply → ${msg.from.name}`, snippet };
  });

  const currentUserId = computed(() => deps.currentUserId.value || "u-1");

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

  function setDraft(v: string): void {
    deps.messageComposer.setDraft(v);
  }

  function handleCancelReply(): void {
    deps.messageComposer.cancelReply();
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
    void deps.messageComposer.sendMessage(payload).then((outcome) => {
      if (outcome.ok) return;
      deps.messageComposer.setActionError(outcome.error);
    });
  }

  async function safeLoadMore(): Promise<void> {
    await deps.onLoadMoreMessages();
  }

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
    fmtTime,
    formatReplyMiniText,
    setDomainId,
    setDraft,
    handleCancelReply,
    handleFileUploaded,
    handleFileUploadError,
    handleSend,
    safeLoadMore,
    handleMessageKeydown,
  };
  return proxyRefs(rawModel);
}
