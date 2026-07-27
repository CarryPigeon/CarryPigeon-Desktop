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
  getAttachments,
  addFiles as addAttachmentFiles,
  removeAttachment,
  clearAttachments,
  getPendingAttachments,
  markDone,
  markError,
  updateProgress,
} from "@/features/chat/message-flow/upload/presentation/runtime/fileAttachmentStore";
import { httpChatApiPort } from "@/features/chat/data/chat-api/httpChatApiPort";
import { getActiveChatServerSocket } from "@/features/chat/composition/serverWorkspaceAdapter";
import { readAuthToken } from "@/shared/utils/localState";
import { IS_STORE_MOCK } from "@/shared/config/runtime";
import {
  addMention,
  availableDomains,
  cancelReply,
  clearSearch,
  composerDraft,
  currentChannelHasMore,
  currentChannelId,
  currentMessages,
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
  recallMessage,
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
import { createMessageActionError } from "./domain/outcomes/messageActionOutcome";

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

  /**
   * 发送消息前先上传所有待上传附件，并按服务端契约发送 Core:File。
   *
   * 流程：
   * 1. `POST /channels/{cid}/messages/attachments` 上传每个 pending 附件；
   * 2. 对每个成功附件发送一条 `Core:File` 消息；
   * 3. 若仍有文本 draft 或显式 payload，再走原有 Core:Text / ReplyText 发送。
   *
   * @param payload - 可选的发送 payload。
   * @returns 发送结果。
   */
  async function sendMessageWithAttachments(
    payload?: import("./api-types").ComposerSubmitPayload,
  ): Promise<import("./api-types").SendChatMessageOutcome> {
    const pending = getPendingAttachments();
    let lastFileOutcome: import("./api-types").SendChatMessageOutcome | null = null;

    if (pending.length > 0) {
      const socket = getActiveChatServerSocket();
      const token = readAuthToken(socket) || "";
      const cid = currentChannelId.value.trim();
      if (!socket || !token || !cid) {
        return sendComposerMessage(payload);
      }

      for (const att of pending) {
        try {
          updateProgress(att.id, 10);
          let uploaded: {
            shareKey: string;
            objectKey: string;
            filename: string;
            mimeType: string;
            size: number;
          };
          if (IS_STORE_MOCK) {
            uploaded = {
              shareKey: `mock-shr-${att.id}`,
              objectKey: `mock/object/${att.id}`,
              filename: att.file.name || "file",
              mimeType: att.file.type || "application/octet-stream",
              size: att.file.size,
            };
          } else {
            uploaded = await httpChatApiPort.uploadMessageAttachment(
              socket,
              token,
              cid,
              att.file,
              "file",
            );
          }
          updateProgress(att.id, 80);
          markDone(att.id, uploaded.shareKey);

          lastFileOutcome = await sendComposerMessage({
            domain: "Core:File",
            domainVersion: "1.0.0",
            data: {
              share_key: uploaded.shareKey,
              object_key: uploaded.objectKey,
              filename: uploaded.filename || att.file.name || "file",
              mime_type: uploaded.mimeType || att.file.type || "application/octet-stream",
              size: uploaded.size || att.file.size,
            },
          });
          if (!lastFileOutcome.ok) {
            markError(att.id, lastFileOutcome.error.message);
          }
        } catch (e) {
          markError(att.id, String(e));
        }
      }
    }

    const draftText = composerDraft.value.trim();
    const hasRealPayload = !!(payload && (String(payload.domain ?? "").trim() || payload.data !== undefined));
    if (draftText || hasRealPayload) {
      const outcome = await sendComposerMessage(payload);
      if (outcome.ok) {
        for (const [id, att] of getAttachments()) {
          if (att.status === "done") removeAttachment(id);
        }
      }
      return outcome;
    }

    if (lastFileOutcome) {
      if (lastFileOutcome.ok) {
        for (const [id, att] of getAttachments()) {
          if (att.status === "done") removeAttachment(id);
        }
      }
      return lastFileOutcome;
    }

    return sendComposerMessage(payload);
  }

  /**
   * 上传并发送一条 Core:Voice 语音消息。
   */
  async function sendVoiceMessage(input: {
    file: File;
    durationMs: number;
  }): Promise<import("./api-types").SendChatMessageOutcome> {
    const socket = getActiveChatServerSocket();
    const token = readAuthToken(socket) || "";
    const cid = currentChannelId.value.trim();
    if (!socket || !token || !cid) {
      const error = createMessageActionError("not_signed_in", "Not signed in or no channel selected.");
      return { ok: false, kind: "chat_message_send_rejected", error };
    }

    // store-mock：退化为本地附件发送，保留时长字段到 Core:Voice data。
    if (IS_STORE_MOCK) {
      return sendComposerMessage({
        domain: "Core:Voice",
        domainVersion: "1.0.0",
        data: {
          share_key: `mock-voice-${Date.now().toString(16)}`,
          filename: input.file.name || "voice.wav",
          mime_type: input.file.type || "audio/wav",
          size: input.file.size,
          duration_millis: Math.max(1, Math.trunc(input.durationMs)),
        },
      });
    }

    try {
      const uploaded = await httpChatApiPort.uploadMessageAttachment(
        socket,
        token,
        cid,
        input.file,
        "voice",
      );

      return await sendComposerMessage({
        domain: "Core:Voice",
        domainVersion: "1.0.0",
        data: {
          share_key: uploaded.shareKey,
          object_key: uploaded.objectKey,
          filename: uploaded.filename || input.file.name || "voice.wav",
          mime_type: uploaded.mimeType || input.file.type || "audio/wav",
          size: uploaded.size || input.file.size,
          duration_millis: Math.max(1, Math.trunc(input.durationMs)),
        },
      });
    } catch (e) {
      const error = createMessageActionError("send_failed", "Send voice message failed.", e);
      return { ok: false, kind: "chat_message_send_rejected", error };
    }
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
      recallMessage,
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
      sendMessage: sendMessageWithAttachments,
      sendVoiceMessage,
      listMentionCandidates: listMentionCandidates,
      addMention: addMention,

      /** Image attachment management for paste/drag-drop upload. */
      get attachments(): readonly import("./api-types").FileAttachment[] {
        return Array.from(getAttachments().values());
      },
      addFiles: addAttachmentFiles,
      removeFile: removeAttachment,
      clearFiles: clearAttachments,

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
