/**
 * @fileoverview account/auth-flow outcome 语义。
 * @description
 * 收敛 auth-flow 对外暴露的显式结果与错误信息，避免 UI 继续依赖异常分支表达正常业务流程。
 */

import type { CurrentUser } from "@/features/account/current-user/application/currentUserContracts";
import type { SemanticErrorInfo, FailureOutcome, SuccessOutcome } from "@/shared/types/semantics";
import {
  AuthError,
  AuthRequiredPluginMissingError,
  type AuthErrorCode,
} from "../domain/errors/AuthErrors";
import type { AuthLoginResult } from "../domain/types/AuthTypes";

export type AuthFlowErrorCode = AuthErrorCode | "unknown_auth_error";

export type AuthFlowErrorInfo = SemanticErrorInfo<AuthFlowErrorCode>;

export type SendVerificationCodeOutcome =
  | SuccessOutcome<"verification_code_sent", { cooldownSec: number }>
  | FailureOutcome<"verification_code_rejected", AuthFlowErrorCode>;

export type RevokeTokenOutcome =
  | SuccessOutcome<"auth_token_revoked", { revoked: true }>
  | FailureOutcome<"auth_token_revoke_rejected", AuthFlowErrorCode>;

export type AuthRequiredSetupOutcome =
  | SuccessOutcome<"required_setup_satisfied", { missingPluginIds: readonly string[] }>
  | SuccessOutcome<"required_setup_required", { missingPluginIds: readonly string[] }>
  | FailureOutcome<"required_setup_unknown", AuthFlowErrorCode>;

export type AuthSignInOutcome =
  | SuccessOutcome<
      "signed_in",
      {
        login: AuthLoginResult;
        currentUser: CurrentUser;
        redirectTo: "/chat";
      }
    >
  | SuccessOutcome<
      "required_setup",
      {
        missingPluginIds: readonly string[];
        redirectTo: "/required-setup";
      }
    >
  | FailureOutcome<"sign_in_rejected", AuthFlowErrorCode>;

export function toAuthFlowErrorInfo(error: unknown): AuthFlowErrorInfo {
  if (error instanceof AuthRequiredPluginMissingError) {
    return {
      code: "required_plugin_missing",
      message: error.message || "Required plugins missing.",
      retryable: false,
      details: { missing_plugins: [...error.payload.missing_plugins] },
    };
  }

  if (error instanceof AuthError) {
    return {
      code: error.code,
      message: error.message || "Auth request failed.",
      retryable:
        error.code !== "missing_server_socket" &&
        error.code !== "missing_email" &&
        error.code !== "missing_code" &&
        error.code !== "missing_email_or_code",
      details: {
        status: error.status,
        reason: error.reason,
        ...error.details,
      },
    };
  }

  return {
    code: "unknown_auth_error",
    message: error instanceof Error ? error.message || "Auth request failed." : String(error) || "Auth request failed.",
    retryable: true,
  };
}
