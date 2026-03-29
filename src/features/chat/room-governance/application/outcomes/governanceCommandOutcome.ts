/**
 * @fileoverview room-governance 命令结果辅助函数。
 * @description
 * 统一治理命令的结构化错误信息与失败结果创建方式，避免各动作散落字符串错误。
 */

import type { FailureOutcome } from "@/shared/types/semantics";
import type { GovernanceCommandErrorCode, GovernanceCommandErrorInfo } from "@/features/chat/room-governance/domain/contracts";

export function createGovernanceCommandError(
  code: GovernanceCommandErrorCode,
  fallbackMessage: string,
  error?: unknown,
  details?: Readonly<Record<string, unknown>>,
): GovernanceCommandErrorInfo {
  return {
    code,
    message: error instanceof Error ? error.message || fallbackMessage : String(error ?? "") || fallbackMessage,
    retryable: code === "governance_action_failed",
    details,
  };
}

export function rejectGovernanceCommand<TFailureKind extends string>(
  kind: TFailureKind,
  code: GovernanceCommandErrorCode,
  fallbackMessage: string,
  error?: unknown,
  details?: Readonly<Record<string, unknown>>,
): FailureOutcome<TFailureKind, GovernanceCommandErrorCode> {
  return {
    ok: false,
    kind,
    error: createGovernanceCommandError(code, fallbackMessage, error, details),
  };
}
