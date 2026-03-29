/**
 * @fileoverview plugins 命令结果语义。
 * @description
 * 统一 plugins 对外暴露的命令结果与稳定错误信息，避免公共边界继续使用 `Promise<void>` 表达有业务分支的动作。
 */

import type { FailureOutcome, SemanticErrorInfo, SuccessOutcome } from "@/shared/types/semantics";
import {
  isPluginOperationError,
  type PluginOperationErrorCode,
} from "@/features/plugins/domain/errors/PluginOperationError";

export type PluginCommandErrorCode = PluginOperationErrorCode | "plugin_busy";

export type PluginCommandErrorInfo = SemanticErrorInfo<PluginCommandErrorCode>;

export type InstallPluginOutcome =
  | SuccessOutcome<"plugin_installed", { pluginId: string; version: string }>
  | FailureOutcome<"plugin_install_rejected", PluginCommandErrorCode>;

export type UpdatePluginToLatestOutcome =
  | SuccessOutcome<"plugin_updated_to_latest", { pluginId: string; version: string }>
  | FailureOutcome<"plugin_update_rejected", PluginCommandErrorCode>;

export type SwitchPluginVersionOutcome =
  | SuccessOutcome<"plugin_version_switched", { pluginId: string; version: string }>
  | FailureOutcome<"plugin_switch_version_rejected", PluginCommandErrorCode>;

export type RollbackPluginOutcome =
  | SuccessOutcome<"plugin_rolled_back", { pluginId: string; version: string }>
  | FailureOutcome<"plugin_rollback_rejected", PluginCommandErrorCode>;

export type EnablePluginOutcome =
  | SuccessOutcome<"plugin_enabled", { pluginId: string; version: string }>
  | FailureOutcome<"plugin_enable_rejected", PluginCommandErrorCode>;

export type DisablePluginOutcome =
  | SuccessOutcome<"plugin_disabled", { pluginId: string }>
  | FailureOutcome<"plugin_disable_rejected", PluginCommandErrorCode>;

export type UninstallPluginOutcome =
  | SuccessOutcome<"plugin_uninstalled", { pluginId: string }>
  | FailureOutcome<"plugin_uninstall_rejected", PluginCommandErrorCode>;

export type PluginLifecycleCommandOutcome =
  | InstallPluginOutcome
  | UpdatePluginToLatestOutcome
  | SwitchPluginVersionOutcome
  | RollbackPluginOutcome
  | EnablePluginOutcome
  | DisablePluginOutcome
  | UninstallPluginOutcome;

export function toPluginCommandErrorInfo(
  code: PluginCommandErrorCode,
  fallbackMessage: string,
  error?: unknown,
  details?: Readonly<Record<string, unknown>>,
): PluginCommandErrorInfo {
  if (isPluginOperationError(error)) {
    return {
      code: error.code,
      message: error.message || fallbackMessage,
      retryable:
        error.code === "plugin_operation_failed" ||
        error.code === "runtime_validation_failed" ||
        error.code === "runtime_reload_failed" ||
        error.code === "runtime_disable_failed" ||
        code === "plugin_busy",
      details: {
        ...error.details,
        ...details,
      },
    };
  }

  return {
    code,
    message: error instanceof Error ? error.message || fallbackMessage : String(error ?? "") || fallbackMessage,
    retryable:
      code === "plugin_busy" ||
      code === "plugin_operation_failed" ||
      code === "runtime_validation_failed" ||
      code === "runtime_reload_failed" ||
      code === "runtime_disable_failed",
    details,
  };
}
