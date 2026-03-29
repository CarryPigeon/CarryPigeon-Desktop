/**
 * @fileoverview ServerInfoError.ts
 * @description server-connection/server-info｜领域错误模型。
 */

export type ServerInfoErrorCode =
  | "missing_server_socket"
  | "get_server_info_failed";

/**
 * server-info 领域统一错误。
 */
export class ServerInfoError extends Error {
  readonly code: ServerInfoErrorCode;
  readonly details: Record<string, unknown>;
  readonly cause: unknown;

  constructor(input: {
    code: ServerInfoErrorCode;
    message: string;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "ServerInfoError";
    this.code = input.code;
    this.details = input.details ?? {};
    this.cause = input.cause;
  }
}

export function isServerInfoError(error: unknown): error is ServerInfoError {
  return error instanceof ServerInfoError;
}

export function toServerInfoError(
  code: ServerInfoErrorCode,
  fallback: string,
  error?: unknown,
  details?: Record<string, unknown>,
): ServerInfoError {
  if (isServerInfoError(error)) return error;
  return new ServerInfoError({
    code,
    message: error instanceof Error ? error.message || fallback : String(error ?? "") || fallback,
    details,
    cause: error,
  });
}
