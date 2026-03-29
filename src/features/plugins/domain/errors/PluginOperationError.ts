/**
 * @fileoverview plugins 领域操作错误。
 * @description
 * 为 plugins 内部用例、数据适配器与 mock 提供稳定错误代数，避免继续传播裸 `Error` 字符串。
 */

export type PluginOperationErrorCode =
  | "missing_server_socket"
  | "missing_plugin_id"
  | "missing_plugin_version"
  | "missing_download_url"
  | "missing_sha256"
  | "plugin_not_installed"
  | "plugin_version_not_installed"
  | "runtime_validation_failed"
  | "runtime_reload_failed"
  | "runtime_disable_failed"
  | "plugin_operation_failed";

export class PluginOperationError extends Error {
  readonly code: PluginOperationErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: PluginOperationErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "PluginOperationError";
    this.code = code;
    this.details = details;
  }
}

export function createPluginOperationError(
  code: PluginOperationErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): PluginOperationError {
  return new PluginOperationError(code, message, details);
}

export function isPluginOperationError(error: unknown): error is PluginOperationError {
  return error instanceof PluginOperationError;
}
