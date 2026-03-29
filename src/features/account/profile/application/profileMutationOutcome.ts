/**
 * @fileoverview account/profile mutation outcome 语义。
 * @description
 * 收敛 profile 写操作对外暴露的显式结果与错误信息，避免调用方继续依赖异常分支表达正常业务失败。
 */

import type { FailureOutcome, SemanticErrorInfo, SuccessOutcome } from "@/shared/types/semantics";
import { ProfileError, type ProfileErrorCode } from "../domain/errors/ProfileErrors";
import { ProfileMutationUnsupportedError } from "../domain/errors/ProfileMutationUnsupportedError";

export type ProfileMutationErrorCode = ProfileErrorCode | "unknown_profile_error";

export type ProfileMutationErrorInfo = SemanticErrorInfo<ProfileMutationErrorCode>;

export type UpdateUserEmailOutcome =
  | SuccessOutcome<"user_email_updated", { email: string }>
  | FailureOutcome<"user_email_update_rejected", ProfileMutationErrorCode>;

export type UpdateUserProfileOutcome =
  | SuccessOutcome<"user_profile_updated", { updatedFields: readonly string[] }>
  | FailureOutcome<"user_profile_update_rejected", ProfileMutationErrorCode>;

export function toProfileMutationErrorInfo(error: unknown): ProfileMutationErrorInfo {
  if (error instanceof ProfileMutationUnsupportedError) {
    return {
      code: error.code,
      message: error.message || "Profile mutation is not supported.",
      retryable: false,
      details: { ...error.details },
    };
  }

  if (error instanceof ProfileError) {
    return {
      code: error.code,
      message: error.message || "Profile request failed.",
      retryable: error.code !== "missing_uid" && error.code !== "mutation_unsupported",
      details: {
        status: error.status,
        reason: error.reason,
        ...error.details,
      },
    };
  }

  return {
    code: "unknown_profile_error",
    message: error instanceof Error ? error.message || "Profile request failed." : String(error) || "Profile request failed.",
    retryable: true,
  };
}
