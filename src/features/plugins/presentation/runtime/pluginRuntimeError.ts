/**
 * @fileoverview plugins runtime 错误。
 * @description
 * 为插件运行时与 host bridge 守卫提供稳定错误语义，避免 presentation/runtime 层散落裸 `Error`。
 */

export type PluginRuntimeErrorCode =
  | "missing_plugin_entry_url"
  | "missing_plugin_host_bridge";

export class PluginRuntimeError extends Error {
  readonly code: PluginRuntimeErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: PluginRuntimeErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "PluginRuntimeError";
    this.code = code;
    this.details = details;
  }
}

export function createPluginRuntimeError(
  code: PluginRuntimeErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): PluginRuntimeError {
  return new PluginRuntimeError(code, message, details);
}
