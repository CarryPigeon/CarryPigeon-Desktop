/**
 * @fileoverview chat/message-flow 对外 API。
 * @description
 * 暴露消息流能力（时间线、composer、发送、回复、删除）。
 */

import { watch } from "vue";
import { clonePlainData } from "@/shared/utils/clonePlainData";
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
  replyToMessageId,
  selectedDomainId,
  sendComposerMessage,
  messageActionError,
  startReply,
} from "./application/messageFlowState";
import type {
  ChatMessage,
  ChatMessageActionErrorInfo,
  ComposerSubmitPayload,
  DeleteChatMessageOutcome,
  MessageDomain,
  SendChatMessageOutcome,
} from "./contracts";

/**
 * message-flow 时间线快照。
 */
export type MessageTimelineSnapshot = {
  currentMessages: readonly ChatMessage[];
  currentMessageCount: number;
  hasMoreHistory: boolean;
  isLoadingHistory: boolean;
};

/**
 * message-flow 时间线局部 capability。
 */
export type MessageTimelineCapabilities = {
  getSnapshot(): MessageTimelineSnapshot;
  observeSnapshot(observer: (snapshot: MessageTimelineSnapshot) => void): () => void;
  findMessageById(messageId: string): ChatMessage | null;
  loadMoreHistory(): Promise<void>;
  beginReply(messageId: string): void;
  deleteMessage(messageId: string): Promise<DeleteChatMessageOutcome>;
};

/**
 * 绑定到某个指定频道的消息读取 capability。
 */
export type ChannelMessageLookupCapabilities = {
  findMessageById(messageId: string): ChatMessage | null;
};

/**
 * message-flow composer 快照。
 */
export type MessageComposerSnapshot = {
  draft: string;
  activeDomainId: string;
  replyToMessageId: string;
  actionError: ChatMessageActionErrorInfo | null;
  availableDomains: readonly MessageDomain[];
};

/**
 * message-flow composer 局部 capability。
 */
export type MessageComposerCapabilities = {
  getSnapshot(): MessageComposerSnapshot;
  observeSnapshot(observer: (snapshot: MessageComposerSnapshot) => void): () => void;
  setDraft(value: string): void;
  setActiveDomainId(value: string): void;
  setActionError(value: ChatMessageActionErrorInfo | null): void;
  appendAttachmentShareKey(shareKey: string): void;
  cancelReply(): void;
  sendMessage(payload?: ComposerSubmitPayload): Promise<SendChatMessageOutcome>;
};

/**
 * message-flow 子域能力对象。
 */
export type MessageFlowCapabilities = {
  currentChannel: MessageTimelineCapabilities;
  composer: MessageComposerCapabilities;
  forChannel(channelId: string): ChannelMessageLookupCapabilities;
};

/**
 * 创建 message-flow 子域能力对象。
 */
export function createMessageFlowCapabilities(): MessageFlowCapabilities {
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

  function observeTimelineSnapshot(observer: (snapshot: MessageTimelineSnapshot) => void): () => void {
    return watch(getTimelineSnapshot, observer, { immediate: true });
  }

  function getComposerSnapshot(): MessageComposerSnapshot {
    return {
      draft: composerDraft.value,
      activeDomainId: selectedDomainId.value,
      replyToMessageId: replyToMessageId.value,
      actionError: messageActionError.value,
      availableDomains: clonePlainData(availableDomains()),
    };
  }

  function observeComposerSnapshot(observer: (snapshot: MessageComposerSnapshot) => void): () => void {
    return watch(getComposerSnapshot, observer, { immediate: true });
  }

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

let messageFlowCapabilitiesSingleton: MessageFlowCapabilities | null = null;

/**
 * 获取 message-flow 子域共享能力对象。
 */
export function getMessageFlowCapabilities(): MessageFlowCapabilities {
  messageFlowCapabilitiesSingleton ??= createMessageFlowCapabilities();
  return messageFlowCapabilitiesSingleton;
}

export type {
  ChatMessage,
  ChatMessageActionErrorInfo,
  ComposerSubmitPayload,
  DeleteChatMessageOutcome,
  MessageDomain,
  SendChatMessageOutcome,
};
