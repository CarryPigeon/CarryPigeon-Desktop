/**
 * @fileoverview message-flow capability source
 * @description
 * 组装 message-flow 子域的内部 capability 来源。
 *
 * 说明：
 * - `api.ts` 不再直接依赖 Vue 或 presentation facade；
 * - 本文件负责把 message-flow runtime store-access 适配为稳定 capability。
 */

import { clonePlainData } from "@/shared/utils/clonePlainData";
import { createWatchedSnapshotObserver } from "@/shared/utils/createWatchedSnapshotObserver";
import { currentServerSocket } from "@/features/server-connection/api";
import { createLocalStorageDraftStorage } from "@/features/chat/message-flow/draft/data/localStorageDraftStorage";
import {
  addMention,
  availableDomains,
  cancelReply,
  clearSearch,
  composerDraft,
  currentChannelHasMore,
  currentMessages,
  deleteMessage,
  draftMentions,
  getMessageById as findMessageByIdInChannel,
  highlightedMessageId,
  listMentionCandidates,
  loadContextAroundMessage,
  loadMoreMessages,
  loadingMoreMessages,
  messageActionError,
  quoteReplyDraft,
  reactToMessage,
  removeReaction,
  replyDraft,
  replyToMessageId,
  searchCurrentChannel,
  searchState,
  selectedDomainId,
  sendComposerMessage,
  startReply,
} from "./presentation/store-access/messageFlowStoreAccess";
import type {
  ChannelMessageLookupCapabilities,
  ChatMessage,
  ChatMessageActionErrorInfo,
  MessageComposerSnapshot,
  MessageFlowCapabilities,
  MessageTimelineSnapshot,
} from "./api-types";

/**
 * 在“当前频道”时间线里按消息 id 查询消息。
 *
 * 这个 helper 只面向 current-channel capability，
 * 因此不会接受任意 `channelId`。
 */
function findCurrentChannelMessageById(messageId: string): ChatMessage | null {
  for (const message of currentMessages.value) {
    if (message.id === messageId) return clonePlainData(message);
  }
  return null;
}

/**
 * 构造当前频道时间线快照。
 *
 * 快照规则：
 * - 始终返回 plain immutable data；
 * - 不把 computed/ref 等 Vue 容器泄漏到 capability 外侧。
 */
function getTimelineSnapshot(): MessageTimelineSnapshot {
  return {
    currentMessages: clonePlainData(currentMessages.value),
    currentMessageCount: currentMessages.value.length,
    hasMoreHistory: currentChannelHasMore.value,
    isLoadingHistory: loadingMoreMessages.value,
    search: { ...searchState.value },
    highlightedMessageId: highlightedMessageId.value,
  };
}

const observeTimelineSnapshot = createWatchedSnapshotObserver(getTimelineSnapshot);

/**
 * 构造 composer 快照。
 *
 * 快照里同时包含：
 * - 当前 draft / activeDomain / replyTo 状态
 * - 当前动作错误投影
 * - 当前可用 domain 列表
 */
function getComposerSnapshot(): MessageComposerSnapshot {
  return {
    draft: composerDraft.value,
    activeDomainId: selectedDomainId.value,
    replyToMessageId: replyToMessageId.value,
    replyDraft: clonePlainData(replyDraft.value),
    draftMentions: clonePlainData(draftMentions.value),
    actionError: messageActionError.value,
    availableDomains: clonePlainData(availableDomains()),
    quoteReplyDraft: clonePlainData(quoteReplyDraft.value),
  };
}

const observeComposerSnapshot = createWatchedSnapshotObserver(getComposerSnapshot);

/**
 * 创建 message-flow 子域内部 capability 源。
 *
 * 说明：
 * - capability-source 是 message-flow 对外的最后一道适配层；
 * - 它把 presentation/store-access 转换成稳定 capability，而不是继续暴露 store。
 */
export function createMessageFlowCapabilitySource(): MessageFlowCapabilities {
  /**
   * 写入 composer draft。
   */
  function setDraft(value: string): void {
    composerDraft.value = value;
  }

  /**
   * 切换当前 composer domain。
   */
  function setActiveDomainId(value: string): void {
    selectedDomainId.value = value;
  }

  /**
   * 由页面层显式覆盖当前动作错误投影。
   */
  function setActionError(value: ChatMessageActionErrorInfo | null): void {
    messageActionError.value = value;
  }

  /**
   * 把上传产物追加成 `[file:shareKey]` 语法 token。
   */
  function appendAttachmentShareKey(shareKey: string): void {
    const text = composerDraft.value;
    composerDraft.value = text ? `${text}\n[file:${shareKey}]` : `[file:${shareKey}]`;
  }

  const draftStorage = createLocalStorageDraftStorage(
    () => currentServerSocket.value ?? "",
  );

  function readChannelDraft(channelId: string): string {
    return draftStorage.readDraft(channelId)?.text ?? "";
  }

  function saveChannelDraft(channelId: string, text: string): void {
    if (!text.trim()) {
      draftStorage.deleteDraft(channelId);
      return;
    }
    draftStorage.saveDraft({ channelId, text, updatedAt: Date.now() });
  }

  function clearChannelDraft(channelId: string): void {
    draftStorage.deleteDraft(channelId);
  }

  return {
    currentChannel: {
      getSnapshot: getTimelineSnapshot,
      observeSnapshot: observeTimelineSnapshot,
      findMessageById: findCurrentChannelMessageById,
      loadMoreHistory: loadMoreMessages,
      beginReply(messageId: string): void {
        const message = findCurrentChannelMessageById(messageId);
        if (message) startReply(message);
      },
      deleteMessage,
      reactToMessage,
      removeReaction,
      searchCurrentChannel,
      loadContextAroundMessage,
      clearSearch,
    },
    composer: {
      getSnapshot: getComposerSnapshot,
      observeSnapshot: observeComposerSnapshot,
      setDraft,
      setActiveDomainId,
      setActionError,
      appendAttachmentShareKey,
      cancelReply,
      sendMessage: sendComposerMessage,
      listMentionCandidates: listMentionCandidates,
      addMention: addMention,
      readChannelDraft,
      saveChannelDraft,
      clearChannelDraft,
      startQuoteReply(messageId: string, userId: string, preview: string): void {
        quoteReplyDraft.value = { messageId, userId, preview };
      },
      cancelQuoteReply(): void {
        quoteReplyDraft.value = null;
      },
    },
    forChannel(channelId: string): ChannelMessageLookupCapabilities {
      return {
        /**
         * 在指定频道里执行只读消息查询。
         */
        findMessageById(messageId: string): ChatMessage | null {
          return findMessageByIdInChannel(channelId, messageId);
        },
      };
    },
  };
}
