/**
 * @fileoverview message-flow 领域契约。
 * @description
 * 由 message-flow 子域持有的稳定公共消息模型与 composer 载荷。
 */

import type { FailureOutcome, SemanticErrorInfo, SuccessOutcome } from "@/shared/types/semantics";
import type { MessageDomainRef, RenderableChatMessage } from "../message/domain/messageModels";

/**
 * message-flow 对外暴露的消息域标识模型。
 */
export type MessageDomain = MessageDomainRef;

/**
 * message-flow 对外暴露的标准消息投影。
 *
 * 说明：
 * - 页面层应把它视为“已可渲染消息”；
 * - wire/domain 细节已经在 message-flow 内部折叠完成。
 */
export type ChatMessage = RenderableChatMessage;

/**
 * composer 显式提交载荷。
 *
 * 当页面层不想直接依赖当前 draft 状态时，可以构造该 payload
 * 作为一次性的发送输入。
 */
export type ComposerSubmitPayload = {
  domain: string;
  domainVersion: string;
  data: unknown;
  replyToMessageId?: string;
};

/**
 * message-flow 命令错误码。
 */
export type ChatMessageActionErrorCode =
  | "plugin_composer_required"
  | "not_signed_in"
  | "channel_not_selected"
  | "missing_message_payload"
  | "missing_domain"
  | "missing_domain_version"
  | "missing_message_id"
  | "stale_runtime_scope"
  | "send_failed"
  | "delete_failed";

/**
 * message-flow 命令失败时的稳定错误代数。
 */
export type ChatMessageActionErrorInfo = SemanticErrorInfo<ChatMessageActionErrorCode>;

/**
 * 发送消息显式结果。
 *
 * 成功时返回标准消息投影，供时间线或调用方立即复用；
 * 失败时返回稳定错误码，避免把业务分支埋在异常字符串里。
 */
export type SendChatMessageOutcome =
  | SuccessOutcome<"chat_message_sent", { message: ChatMessage }>
  | FailureOutcome<"chat_message_send_rejected", ChatMessageActionErrorCode>;

/**
 * 删除消息显式结果。
 */
export type DeleteChatMessageOutcome =
  | SuccessOutcome<"chat_message_deleted", { messageId: string }>
  | FailureOutcome<"chat_message_delete_rejected", ChatMessageActionErrorCode>;
