/**
 * @fileoverview composer 行为（回复态 + 发送消息）。
 * @description chat/message-flow｜application：回复态与发送消息编排。
 */

import type { ChatMessageRecord, ChatSendMessageInput } from "@/features/chat/domain/types/chatApiModels";
import type {
  ChatMessage,
  ComposerSubmitPayload,
  SendChatMessageOutcome,
} from "@/features/chat/message-flow/domain/contracts";
import { createMessageActionError, rejectMessageAction } from "../outcomes/messageActionOutcome";
import type {
  MessageComposerStatePort,
  MessageFlowApiPort,
  MessageFlowScopePort,
  MessageTimelineStatePort,
  ReadStateReporterPort,
} from "../ports";

type MapWireMessage = (serverSocket: string, msg: ChatMessageRecord) => ChatMessage;

export type ComposerActionsDeps = {
  /**
   * composer 依赖的状态面只覆盖“发送链路”真正需要的部分：
   * - 当前频道
   * - draft / reply / domain
   * - 时间线缓存
   * - 已读推进器
   */
  api: MessageFlowApiPort;
  scope: MessageFlowScopePort;
  timelineState: MessageTimelineStatePort;
  composerState: MessageComposerStatePort;
  mapWireMessage: MapWireMessage;
  readStateReporter: ReadStateReporterPort;
};

export type ComposerActions = {
  /**
   * 进入回复态。
   */
  startReply(messageId: string): void;
  /**
   * 取消回复态。
   */
  cancelReply(): void;
  /**
   * 发送消息。
   *
   * 两种模式：
   * - 不传 payload：发送 Core:Text draft
   * - 传 payload：发送插件 composer 产出的结构化消息
   */
  sendComposerMessage(payload?: ComposerSubmitPayload): Promise<SendChatMessageOutcome>;
};

export function createComposerActions(deps: ComposerActionsDeps): ComposerActions {
  function startReply(messageId: string): void {
    deps.composerState.setReplyToMessageId(messageId);
    deps.composerState.writeActionError(null);
  }

  function cancelReply(): void {
    deps.composerState.clearReplyToMessageId();
  }

  function createIdempotencyKey(): string {
    const v = globalThis.crypto?.randomUUID?.();
    if (typeof v === "string" && v.trim()) return v;
    return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  async function sendComposerMessage(payload?: ComposerSubmitPayload): Promise<SendChatMessageOutcome> {
    /**
     * 这里统一处理“文本发送”和“插件 composer 发送”。
     *
     * 规则：
     * - Core:Text 可以直接从 draft 构造 payload；
     * - 非 Core domain 必须由插件 composer 提供显式 payload；
     * - 发送成功后，乐观写回当前频道时间线，并推进本地读状态。
     */
    const uiDomain = deps.composerState.readSelectedDomainId();
    const replyToMid = deps.composerState.readReplyToMessageId() || undefined;

    const isCoreText = uiDomain === "Core:Text";
    const text = deps.composerState.readDraft().trim();

    if (!payload && isCoreText && !text) {
      return rejectMessageAction("chat_message_send_rejected", "missing_message_payload", "Missing message payload.");
    }
    if (!payload && !isCoreText) {
      const error = createMessageActionError("plugin_composer_required", "This domain requires a plugin composer.");
      deps.composerState.writeActionError(error);
      return { ok: false, kind: "chat_message_send_rejected", error };
    }

    const [socket, token] = await deps.scope.getSocketAndValidToken();
    if (!socket || !token) {
      const error = createMessageActionError("not_signed_in", "Not signed in.");
      deps.composerState.writeActionError(error);
      return { ok: false, kind: "chat_message_send_rejected", error };
    }
    const requestSocket = socket;
    const requestScopeVersion = deps.scope.getActiveScopeVersion();

    const cid = deps.timelineState.readCurrentChannelId();
    if (!cid) {
      const error = createMessageActionError("channel_not_selected", "No channel selected.");
      deps.composerState.writeActionError(error);
      return { ok: false, kind: "chat_message_send_rejected", error };
    }

    deps.composerState.writeActionError(null);

    const apiDomain = payload ? String(payload.domain ?? "").trim() : uiDomain;
    const apiVersion = payload ? String(payload.domainVersion ?? "").trim() : "1.0.0";
    const data = payload ? payload.data : { text };
    const finalReplyToMid = payload?.replyToMessageId ? String(payload.replyToMessageId).trim() : replyToMid;
    if (!apiDomain) {
      const error = createMessageActionError("missing_domain", "Missing domain.");
      deps.composerState.writeActionError(error);
      return { ok: false, kind: "chat_message_send_rejected", error };
    }
    if (!apiVersion) {
      const error = createMessageActionError("missing_domain_version", "Missing domainVersion.");
      deps.composerState.writeActionError(error);
      return { ok: false, kind: "chat_message_send_rejected", error };
    }

    try {
      const req: ChatSendMessageInput = { domain: apiDomain, domainVersion: apiVersion, data, replyToMessageId: finalReplyToMid };
      const created = await deps.api.sendChannelMessage(socket, token, cid, req, createIdempotencyKey());
      const mapped = deps.mapWireMessage(socket, created);
      if (deps.scope.getActiveServerSocket() !== requestSocket || deps.scope.getActiveScopeVersion() !== requestScopeVersion) {
        return rejectMessageAction(
          "chat_message_send_rejected",
          "stale_runtime_scope",
          "Chat runtime changed before the send result could be applied.",
          undefined,
          { requestSocket, cid },
        );
      }
      deps.timelineState.appendMessageIfMissing(cid, mapped, (a, b) => a.timeMs === b.timeMs ? a.id.localeCompare(b.id) : a.timeMs - b.timeMs);

      deps.composerState.clearReplyToMessageId();
      if (!payload) deps.composerState.clearDraft();

      const now = Date.now();
      const nextReadTime = deps.readStateReporter.advanceLocalReadTime(cid, now);
      void deps.readStateReporter.reportIfAllowed(cid, mapped.id, nextReadTime, now, 1500);
      return {
        ok: true,
        kind: "chat_message_sent",
        message: mapped,
      };
    } catch (e) {
      const error = createMessageActionError("send_failed", "Send failed.", e);
      deps.composerState.writeActionError(error);
      return {
        ok: false,
        kind: "chat_message_send_rejected",
        error,
      };
    }
  }

  return { startReply, cancelReply, sendComposerMessage };
}
