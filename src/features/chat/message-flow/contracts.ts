/**
 * @fileoverview message-flow 展示契约。
 * @description
 * 由 message-flow 子域持有的稳定公共消息模型与 composer 载荷。
 */

import type { FailureOutcome, SemanticErrorInfo, SuccessOutcome } from "@/shared/types/semantics";
import type { MessageDomainRef, RenderableChatMessage } from "./message/domain/messageModels";

export type MessageDomain = MessageDomainRef;

export type ChatMessage = RenderableChatMessage;

export type ComposerSubmitPayload = {
  domain: string;
  domainVersion: string;
  data: unknown;
  replyToMessageId?: string;
};

export type ChatMessageActionErrorCode =
  | "plugin_composer_required"
  | "not_signed_in"
  | "channel_not_selected"
  | "missing_domain"
  | "missing_domain_version"
  | "stale_runtime_scope"
  | "send_failed"
  | "delete_failed";

export type ChatMessageActionErrorInfo = SemanticErrorInfo<ChatMessageActionErrorCode>;

export type SendChatMessageOutcome =
  | SuccessOutcome<"chat_message_sent", { message: ChatMessage }>
  | FailureOutcome<"chat_message_send_rejected", ChatMessageActionErrorCode>;

export type DeleteChatMessageOutcome =
  | SuccessOutcome<"chat_message_deleted", { messageId: string }>
  | FailureOutcome<"chat_message_delete_rejected", ChatMessageActionErrorCode>;
