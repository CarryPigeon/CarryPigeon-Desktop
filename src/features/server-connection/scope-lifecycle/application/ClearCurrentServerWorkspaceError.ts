/**
 * @fileoverview ClearCurrentServerWorkspaceError
 * @description server-connection/scope-lifecycle｜应用层错误模型：清理当前 server workspace。
 */

import type { ClearCurrentServerWorkspaceStep } from "./clearCurrentServerWorkspaceFlow";

export type ClearCurrentServerWorkspaceErrorCode =
  | "missing_server_socket"
  | "critical_step_failed";

/**
 * clear-current-workspace 用例的稳定错误语义。
 */
export class ClearCurrentServerWorkspaceError extends Error {
  readonly code: ClearCurrentServerWorkspaceErrorCode;
  readonly step: ClearCurrentServerWorkspaceStep | null;
  readonly details: Record<string, unknown>;
  readonly cause: unknown;

  constructor(input: {
    code: ClearCurrentServerWorkspaceErrorCode;
    message: string;
    step?: ClearCurrentServerWorkspaceStep | null;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "ClearCurrentServerWorkspaceError";
    this.code = input.code;
    this.step = input.step ?? null;
    this.details = input.details ?? {};
    this.cause = input.cause;
  }
}

export function isClearCurrentServerWorkspaceError(error: unknown): error is ClearCurrentServerWorkspaceError {
  return error instanceof ClearCurrentServerWorkspaceError;
}

export function toClearCurrentServerWorkspaceStepError(
  step: ClearCurrentServerWorkspaceStep,
  error: unknown,
): ClearCurrentServerWorkspaceError {
  if (isClearCurrentServerWorkspaceError(error)) return error;
  return new ClearCurrentServerWorkspaceError({
    code: "critical_step_failed",
    message: `Current server workspace clear failed at step "${step}".`,
    step,
    details: { step },
    cause: error,
  });
}
