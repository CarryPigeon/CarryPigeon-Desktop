/**
 * @fileoverview composer 行为（回复态 + 发送消息）。
 * @description chat/message-flow｜application：回复态与发送消息编排。
 */

import type { Ref } from "vue";
import type { ChatMessageRecord, ChatSendMessageInput } from "@/features/chat/domain/types/chatApiModels";
import type {
  ChatMessage,
  ChatMessageActionErrorCode,
  ChatMessageActionErrorInfo,
  ComposerSubmitPayload,
  SendChatMessageOutcome,
} from "@/features/chat/message-flow/contracts";
import type { MessageFlowApiPort, ReadStateReporterPort } from "./ports";

type MapWireMessage = (serverSocket: string, msg: ChatMessageRecord) => ChatMessage;

export type ComposerActionsDeps = {
  api: MessageFlowApiPort;
  getSocketAndValidToken: () => Promise<[string, string]>;
  getActiveServerSocket: () => string;
  getActiveScopeVersion: () => number;
  currentChannelId: Ref<string>;
  messagesByChannel: Record<string, ChatMessage[]>;
  selectedDomainId: Ref<string>;
  composerDraft: Ref<string>;
  replyToMessageId: Ref<string>;
  messageActionError: Ref<ChatMessageActionErrorInfo | null>;
  mapWireMessage: MapWireMessage;
  readStateReporter: ReadStateReporterPort;
};

export type ComposerActions = {
  startReply(messageId: string): void;
  cancelReply(): void;
  sendComposerMessage(payload?: ComposerSubmitPayload): Promise<SendChatMessageOutcome>;
};

function createMessageActionError(
  code: ChatMessageActionErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ChatMessageActionErrorInfo {
  return {
    code,
    message,
    retryable: code === "send_failed" || code === "delete_failed",
    details,
  };
}

export function createComposerActions(deps: ComposerActionsDeps): ComposerActions {
  function startReply(messageId: string): void {
    deps.replyToMessageId.value = messageId;
    deps.messageActionError.value = null;
  }

  function cancelReply(): void {
    deps.replyToMessageId.value = "";
  }

  function createIdempotencyKey(): string {
    const v = globalThis.crypto?.randomUUID?.();
    if (typeof v === "string" && v.trim()) return v;
    return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  async function sendComposerMessage(payload?: ComposerSubmitPayload): Promise<SendChatMessageOutcome> {
    const uiDomain = deps.selectedDomainId.value.trim();
    const replyToMid = deps.replyToMessageId.value.trim() || undefined;

    const isCoreText = uiDomain === "Core:Text";
    const text = deps.composerDraft.value.trim();

    if (!payload && isCoreText && !text) {
      return {
        ok: false,
        kind: "chat_message_send_rejected",
        error: createMessageActionError("missing_domain", "Missing message payload."),
      };
    }
    if (!payload && !isCoreText) {
      const error = createMessageActionError("plugin_composer_required", "This domain requires a plugin composer.");
      deps.messageActionError.value = error;
      return { ok: false, kind: "chat_message_send_rejected", error };
    }

    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) {
      const error = createMessageActionError("not_signed_in", "Not signed in.");
      deps.messageActionError.value = error;
      return { ok: false, kind: "chat_message_send_rejected", error };
    }
    const requestSocket = socket;
    const requestScopeVersion = deps.getActiveScopeVersion();

    const cid = deps.currentChannelId.value;
    if (!cid) {
      const error = createMessageActionError("channel_not_selected", "No channel selected.");
      deps.messageActionError.value = error;
      return { ok: false, kind: "chat_message_send_rejected", error };
    }

    deps.messageActionError.value = null;

    const apiDomain = payload ? String(payload.domain ?? "").trim() : uiDomain;
    const apiVersion = payload ? String(payload.domainVersion ?? "").trim() : "1.0.0";
    const data = payload ? payload.data : { text };
    const finalReplyToMid = payload?.replyToMessageId ? String(payload.replyToMessageId).trim() : replyToMid;
    if (!apiDomain) {
      const error = createMessageActionError("missing_domain", "Missing domain.");
      deps.messageActionError.value = error;
      return { ok: false, kind: "chat_message_send_rejected", error };
    }
    if (!apiVersion) {
      const error = createMessageActionError("missing_domain_version", "Missing domainVersion.");
      deps.messageActionError.value = error;
      return { ok: false, kind: "chat_message_send_rejected", error };
    }

    try {
      const req: ChatSendMessageInput = { domain: apiDomain, domainVersion: apiVersion, data, replyToMessageId: finalReplyToMid };
      const created = await deps.api.sendChannelMessage(socket, token, cid, req, createIdempotencyKey());
      const mapped = deps.mapWireMessage(socket, created);
      if (deps.getActiveServerSocket() !== requestSocket || deps.getActiveScopeVersion() !== requestScopeVersion) {
        return {
          ok: false,
          kind: "chat_message_send_rejected",
          error: createMessageActionError(
            "stale_runtime_scope",
            "Chat runtime changed before the send result could be applied.",
            { requestSocket, cid },
          ),
        };
      }
      const list = deps.messagesByChannel[cid] ?? (deps.messagesByChannel[cid] = []);
      if (!list.some((x) => x.id === mapped.id)) list.push(mapped);

      deps.replyToMessageId.value = "";
      if (!payload) deps.composerDraft.value = "";

      const now = Date.now();
      const nextReadTime = deps.readStateReporter.advanceLocalReadTime(cid, now);
      void deps.readStateReporter.reportIfAllowed(cid, mapped.id, nextReadTime, now, 1500);
      return {
        ok: true,
        kind: "chat_message_sent",
        message: mapped,
      };
    } catch (e) {
      const error = createMessageActionError("send_failed", e instanceof Error ? e.message || "Send failed." : String(e) || "Send failed.");
      deps.messageActionError.value = error;
      return {
        ok: false,
        kind: "chat_message_send_rejected",
        error,
      };
    }
  }

  return { startReply, cancelReply, sendComposerMessage };
}
