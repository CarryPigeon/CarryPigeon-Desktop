/**
 * @fileoverview Tauri 命令名常量表。
 * @description 所有 `invokeTauri()` 的 command name 统一从这里引用，避免散落硬编码字符串。
 */
/**
 * @constant
 * @description Rust 侧暴露给前端的命令名（Tauri commands）。
 */
export const TAURI_COMMANDS = {
  addTcpService: "add_tcp_service",
  sendTcpService: "send_tcp_service",
  dbInit: "db_init",
  dbExecute: "db_execute",
  dbQuery: "db_query",
  dbTransaction: "db_transaction",
  dbClose: "db_close",
  dbRemove: "db_remove",
  dbPath: "db_path",

  toChatWindowSize: "to_chat_window_size",
  openPopoverWindow: "open_popover_window",
  openInfoWindow: "open_info_window",

  logInfo: "log_info",
  logError: "log_error",
  logWarning: "log_warning",
  logDebug: "log_debug",

  loadPlugin: "load_plugin",
  listPlugins: "list_plugins",
} as const;

export type TauriCommandName = (typeof TAURI_COMMANDS)[keyof typeof TAURI_COMMANDS];
