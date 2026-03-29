/**
 * @fileoverview chat center model
 * @description
 * 收敛 ChatCenter 所需的消息流、连接状态、composer 状态与交互动作，避免布局组件直接依赖多个 store。
 */

import { computed, proxyRefs, type Component, type ComputedRef, type Ref, type ShallowUnwrapRef } from "vue";
import { currentChatUserId } from "@/features/chat/integration/accountSession";
import {
  chatConnectionDetail,
  chatConnectionPillState,
  retryChatConnection,
} from "@/features/chat/integration/serverWorkspace";
import {
  getRoomSessionCapabilities,
  type CurrentChannelSessionSnapshot,
} from "@/features/chat/room-session/api";
import {
  getMessageFlowCapabilities,
  type ChatMessage,
  type ComposerSubmitPayload,
  type MessageComposerSnapshot,
  type MessageTimelineSnapshot,
} from "@/features/chat/message-flow/api";
import type { ServerWorkspaceConnectionOutcome } from "@/features/server-connection/api-types";
import { isMessageAfterReadMarker } from "@/features/chat/presentation/utils/readMarker";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";

const roomSessionCapabilities = getRoomSessionCapabilities();
const messageFlowCapabilities = getMessageFlowCapabilities();

type RefLike<T> = Ref<T> | ComputedRef<T>;

export type DomainRegistryStoreLike = {
  getBinding(domainId: string): {
    pluginId: string;
    composer?: Component | null;
    renderer?: unknown;
  } | null;
  getContextForPlugin(pluginId: string): unknown;
  getContextForDomain(domainId: string): unknown;
};

export type MessageRow = {
  m: ChatMessage;
  isGroupStart: boolean;
  isUnreadStart: boolean;
};

type ChatCenterRawModel = {
  connectionDetail: typeof chatConnectionDetail;
  connectionPillState: typeof chatConnectionPillState;
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
export type ChatCenterModel = ShallowUnwrapRef<ChatCenterRawModel>;

export type UseChatCenterModelDeps = {
  domainRegistryView: RefLike<unknown>;
  onLoadMoreMessages(): void | Promise<void>;
  onReplyShortcut(messageId: string): void;
  onDeleteShortcut(messageId: string): void;
  onMessageContextMenu(e: MouseEvent, messageId: string): void;
};

export function useChatCenterModel(deps: UseChatCenterModelDeps): ChatCenterModel {
  const currentSession = roomSessionCapabilities.currentChannel;
  const currentChannelMessageFlow = messageFlowCapabilities.currentChannel;
  const messageComposer = messageFlowCapabilities.composer;
  const currentSessionSnapshot = useObservedCapabilitySnapshot(currentSession);
  const messageTimelineSnapshot = useObservedCapabilitySnapshot(currentChannelMessageFlow);
  const messageComposerSnapshot = useObservedCapabilitySnapshot(messageComposer);
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
    const id = messageComposerSnapshot.value.replyToMessageId;
    if (!id) return { title: "", snippet: "" };
    const msg = currentChannelMessageFlow.findMessageById(id);
    if (!msg) return { title: "Reply", snippet: "Message not found" };
    const snippet = msg.kind === "core_text" ? msg.text : msg.preview;
    return { title: `Reply → ${msg.from.name}`, snippet };
  });

  const currentUserId = computed(() => currentChatUserId.value || "u-1");

  function fmtTime(ms: number): string {
    return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatReplyMiniText(channelId: string, replyToId: string): string {
    const r = messageFlowCapabilities.forChannel(channelId).findMessageById(replyToId);
    if (!r) return "—";
    const snippet = r.kind === "core_text" ? r.text : r.preview;
    return `${r.from.name}: ${snippet}`;
  }

  function setDomainId(v: string): void {
    messageComposer.setActiveDomainId(v);
  }

  function setDraft(v: string): void {
    messageComposer.setDraft(v);
  }

  function handleCancelReply(): void {
    messageComposer.cancelReply();
  }

  function handleFileUploaded(result: { fileId: string; shareKey: string }): void {
    messageComposer.appendAttachmentShareKey(result.shareKey);
  }

  function handleFileUploadError(error: string): void {
    messageComposer.setActionError({
      code: "send_failed",
      message: error,
      retryable: true,
    });
  }

  function handleSend(payload?: ComposerSubmitPayload): void {
    void messageComposer.sendMessage(payload).then((outcome) => {
      if (outcome.ok) return;
      messageComposer.setActionError(outcome.error);
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
    connectionDetail: chatConnectionDetail,
    connectionPillState: chatConnectionPillState,
    retryConnection: retryChatConnection,
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
