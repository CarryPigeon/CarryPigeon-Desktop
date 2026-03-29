/**
 * @fileoverview message-flow 命令结果辅助函数。
 * @description
 * 统一发送/删除消息的结构化错误信息与失败结果创建方式，避免各动作散落字符串错误和重复的 ErrorInfo 构造。
 */

import type { FailureOutcome } from "@/shared/types/semantics";
import type { ChatMessageActionErrorCode, ChatMessageActionErrorInfo } from "@/features/chat/message-flow/domain/contracts";

export function createMessageActionError(
  code: ChatMessageActionErrorCode,
  fallbackMessage: string,
  error?: unknown,
  details?: Readonly<Record<string, unknown>>,
): ChatMessageActionErrorInfo {
  return {
    code,
    message: error instanceof Error ? error.message || fallbackMessage : String(error ?? "") || fallbackMessage,
    retryable: code === "send_failed" || code === "delete_failed",
    details,
  };
}

export function rejectMessageAction<TFailureKind extends string>(
  kind: TFailureKind,
  code: ChatMessageActionErrorCode,
  fallbackMessage: string,
  error?: unknown,
  details?: Readonly<Record<string, unknown>>,
): FailureOutcome<TFailureKind, ChatMessageActionErrorCode> {
  return {
    ok: false,
    kind,
    error: createMessageActionError(code, fallbackMessage, error, details),
  };
}
