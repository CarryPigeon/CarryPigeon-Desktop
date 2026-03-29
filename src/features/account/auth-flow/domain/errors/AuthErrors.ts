/**
 * @fileoverview AuthErrors.ts
 * @description account/auth-flow｜模块：AuthErrors。
 */

export type AuthErrorCode =
  | "missing_server_socket"
  | "missing_email"
  | "missing_code"
  | "missing_email_or_code"
  | "missing_token"
  | "missing_refresh_token"
  | "send_code_failed"
  | "login_failed"
  | "token_login_failed"
  | "refresh_failed"
  | "revoke_failed"
  | "required_plugin_missing";

/**
 * auth-flow 统一错误模型。
 *
 * 说明：
 * - `code`：稳定的机器可读错误码；
 * - `status/reason/details`：透传 API 错误关键信息，便于上层分支。
 */
export class AuthError extends Error {
  public readonly code: AuthErrorCode;
  public readonly status: number | null;
  public readonly reason: string;
  public readonly details: Record<string, unknown>;
  public readonly cause: unknown;

  constructor(input: {
    code: AuthErrorCode;
    message: string;
    status?: number | null;
    reason?: string;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "AuthError";
    this.code = input.code;
    this.status = input.status ?? null;
    this.reason = String(input.reason ?? "").trim();
    this.details = input.details ?? {};
    this.cause = input.cause;
  }
}

/**
 * 必需插件缺失错误的载荷结构（与服务端 reason 对齐）。
 */
export type RequiredPluginMissingPayload = {
  reason: "required_plugin_missing";
  missing_plugins: string[];
};

/**
 * 必需插件缺失错误。
 *
 * 说明：
 * - 用于 required gate 阶段：当服务端声明“必须插件”但客户端未安装/未启用时抛出；
 * - `payload.missing_plugins` 用于 UI 给出明确的安装指引。
 */
export class AuthRequiredPluginMissingError extends AuthError {
  constructor(public readonly payload: RequiredPluginMissingPayload) {
    const missing = payload.missing_plugins.join(", ");
    super({
      code: "required_plugin_missing",
      message: `Required plugins missing: ${missing || "unknown"}`,
      reason: payload.reason,
      details: { missing_plugins: payload.missing_plugins },
    });
    this.name = "AuthRequiredPluginMissingError";
  }
}

/**
 * 类型守卫：判断未知错误是否为 `AuthRequiredPluginMissingError`。
 *
 * @param e - 捕获到的未知错误对象。
 * @returns 当 `e` 是 `AuthRequiredPluginMissingError` 实例时返回 `true`。
 */
export function isAuthRequiredPluginMissingError(e: unknown): e is AuthRequiredPluginMissingError {
  return e instanceof AuthRequiredPluginMissingError;
}

/**
 * 类型守卫：判断未知错误是否为 `AuthError`。
 *
 * @param e - 捕获到的未知错误对象。
 * @returns 当 `e` 是 `AuthError` 时返回 `true`。
 */
export function isAuthError(e: unknown): e is AuthError {
  return e instanceof AuthError;
}

/**
 * 将 auth-flow 异常转换为稳定的 UI 文案。
 *
 * @param e - 未知错误。
 * @returns 可直接展示的错误文本。
 */
export function toAuthErrorMessage(e: unknown): string {
  if (isAuthRequiredPluginMissingError(e)) {
    const ids = e.payload.missing_plugins.join(", ");
    return ids ? `Required plugins missing: ${ids}` : "Required plugins missing.";
  }

  if (isAuthError(e)) {
    switch (e.code) {
      case "missing_server_socket":
        return "Missing server socket.";
      case "missing_email":
        return "Missing email.";
      case "missing_code":
        return "Missing code.";
      case "missing_email_or_code":
        return "Missing email or code.";
      case "missing_token":
        return "Missing token.";
      case "missing_refresh_token":
        return "Missing refresh token.";
      default:
        return e.message || "Auth request failed.";
    }
  }

  if (e instanceof Error) return e.message || String(e);
  return String(e) || "Auth request failed.";
}
