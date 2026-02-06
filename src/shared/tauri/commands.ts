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
  apiRequestJson: "api_request_json",
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

  // 插件：zip 包产物 + 本地生命周期管理
  pluginsListInstalled: "plugins_list_installed",
  pluginsGetInstalledState: "plugins_get_installed_state",
  pluginsGetRuntimeEntry: "plugins_get_runtime_entry",
  pluginsGetRuntimeEntryForVersion: "plugins_get_runtime_entry_for_version",
  pluginsInstallFromServerCatalog: "plugins_install_from_server_catalog",
  pluginsInstallFromUrl: "plugins_install_from_url",
  pluginsEnable: "plugins_enable",
  pluginsDisable: "plugins_disable",
  pluginsSwitchVersion: "plugins_switch_version",
  pluginsUninstall: "plugins_uninstall",
  pluginsSetFailed: "plugins_set_failed",
  pluginsClearError: "plugins_clear_error",

  // 插件宿主 API（按权限 gated）
  pluginsStorageGet: "plugins_storage_get",
  pluginsStorageSet: "plugins_storage_set",
  pluginsNetworkFetch: "plugins_network_fetch",
} as const;

/**
 * Tauri 命令名联合类型（由 `TAURI_COMMANDS` 推导）。
 */
export type TauriCommandName = (typeof TAURI_COMMANDS)[keyof typeof TAURI_COMMANDS];
