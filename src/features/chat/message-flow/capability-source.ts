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
import {
  availableDomains,
  cancelReply,
  composerDraft,
  currentChannelHasMore,
  currentMessages,
  deleteMessage,
  getMessageById as findMessageByIdInChannel,
  loadMoreMessages,
  loadingMoreMessages,
  messageActionError,
  replyToMessageId,
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

function findCurrentChannelMessageById(messageId: string): ChatMessage | null {
  for (const message of currentMessages.value) {
    if (message.id === messageId) return clonePlainData(message);
  }
  return null;
}

function getTimelineSnapshot(): MessageTimelineSnapshot {
  return {
    currentMessages: clonePlainData(currentMessages.value),
    currentMessageCount: currentMessages.value.length,
    hasMoreHistory: currentChannelHasMore.value,
    isLoadingHistory: loadingMoreMessages.value,
  };
}

const observeTimelineSnapshot = createWatchedSnapshotObserver(getTimelineSnapshot);

function getComposerSnapshot(): MessageComposerSnapshot {
  return {
    draft: composerDraft.value,
    activeDomainId: selectedDomainId.value,
    replyToMessageId: replyToMessageId.value,
    actionError: messageActionError.value,
    availableDomains: clonePlainData(availableDomains()),
  };
}

const observeComposerSnapshot = createWatchedSnapshotObserver(getComposerSnapshot);

/**
 * 创建 message-flow 子域内部 capability 源。
 */
export function createMessageFlowCapabilitySource(): MessageFlowCapabilities {
  function setDraft(value: string): void {
    composerDraft.value = value;
  }

  function setActiveDomainId(value: string): void {
    selectedDomainId.value = value;
  }

  function setActionError(value: ChatMessageActionErrorInfo | null): void {
    messageActionError.value = value;
  }

  function appendAttachmentShareKey(shareKey: string): void {
    const text = composerDraft.value;
    composerDraft.value = text ? `${text}\n[file:${shareKey}]` : `[file:${shareKey}]`;
  }

  return {
    currentChannel: {
      getSnapshot: getTimelineSnapshot,
      observeSnapshot: observeTimelineSnapshot,
      findMessageById: findCurrentChannelMessageById,
      loadMoreHistory: loadMoreMessages,
      beginReply: startReply,
      deleteMessage,
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
    },
    forChannel(channelId: string): ChannelMessageLookupCapabilities {
      return {
        findMessageById(messageId: string): ChatMessage | null {
          return findMessageByIdInChannel(channelId, messageId);
        },
      };
    },
  };
}
