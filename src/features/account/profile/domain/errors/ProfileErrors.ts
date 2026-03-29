/**
 * @fileoverview ProfileErrors.ts
 * @description account/profile｜领域错误模型。
 */

export type ProfileErrorCode =
  | "missing_uid"
  | "get_me_failed"
  | "get_user_failed"
  | "list_users_failed"
  | "mutation_unsupported";

/**
 * profile 领域统一错误。
 */
export class ProfileError extends Error {
  public readonly code: ProfileErrorCode;
  public readonly status: number | null;
  public readonly reason: string;
  public readonly details: Record<string, unknown>;
  public readonly cause: unknown;

  constructor(input: {
    code: ProfileErrorCode;
    message: string;
    status?: number | null;
    reason?: string;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "ProfileError";
    this.code = input.code;
    this.status = input.status ?? null;
    this.reason = String(input.reason ?? "").trim();
    this.details = input.details ?? {};
    this.cause = input.cause;
  }
}

/**
 * 类型守卫：判断错误是否为 ProfileError。
 *
 * @param e - 任意错误对象。
 * @returns 命中则为 `true`。
 */
export function isProfileError(e: unknown): e is ProfileError {
  return e instanceof ProfileError;
}

/**
 * profile 错误展示文案（UI 友好）。
 *
 * @param e - 任意错误对象。
 * @returns 可展示的错误文案。
 */
export function toProfileErrorMessage(e: unknown): string {
  if (isProfileError(e)) return e.message || "Profile request failed.";
  if (e instanceof Error) return e.message || String(e);
  return String(e) || "Profile request failed.";
}
