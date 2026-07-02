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
  removeTcpService: "remove_tcp_service",
  sendTcpService: "send_tcp_service",
  apiRequestJson: "api_request_json",
  dbInit: "db_init",
  dbExecute: "db_execute",
  dbQuery: "db_query",
  dbTransaction: "db_transaction",
  dbClose: "db_close",
  dbRemove: "db_remove",
  dbPath: "db_path",

  chatCacheLoadAll: "chat_cache_load_all",
  chatCacheGet: "chat_cache_get",
  chatCachePut: "chat_cache_put",
  chatCacheRemove: "chat_cache_remove",
  chatCacheRemoveMany: "chat_cache_remove_many",
  chatCacheClearAll: "chat_cache_clear_all",

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

  settingsGetConfigBool: "get_config_bool",
  settingsUpdateConfigBool: "update_config_bool",
  settingsUpdateConfigString: "update_config_string",
  settingsGetConfig: "get_config",
  settingsGetConfigU32: "get_config_u32",
  settingsGetConfigString: "get_config_string",
  settingsUpdateConfigU32: "update_config_u32",
  settingsExportSettings: "export_settings",
  settingsImportSettings: "import_settings",
  settingsResetSettings: "reset_settings",

  setTrayUnreadFlashing: "set_tray_unread_flashing",
  setTrayLocale: "set_tray_locale",
  closeTrayNotificationPopover: "close_tray_notification_popover",

  downloadFile: "download_file",

  // opener plugin
  openUrl: "plugin:opener|open_url",

  // link preview
  fetchLinkPreview: "fetch_link_preview",

  // voice message
  startVoiceRecording: "start_voice_recording",
  stopVoiceRecording: "stop_voice_recording",
  readFileBase64: "read_file_base64",
  readFileBase64Chunk: "read_file_base64_chunk",

  // emoji
  listCustomEmojis: "list_custom_emojis",
  saveEmoji: "save_emoji",
  deleteEmoji: "delete_emoji",
  copyEmoji: "copy_emoji",
  writeTempEmojiFile: "write_temp_emoji_file",
  getEmojiImagePath: "get_emoji_image_path",

  // screenshot
  startScreenshot: "start_screenshot",
  getScreenshotData: "get_screenshot_data",
  finishScreenshot: "finish_screenshot",
  cancelScreenshot: "cancel_screenshot",

  // voice call
  connectSignaling: "connect_signaling",
  startDirectCall: "start_direct_call",
  startConference: "start_conference",
  acceptCall: "accept_call",
  rejectCall: "reject_call",
  hangupCall: "hangup_call",
  toggleMute: "toggle_mute",
  toggleNoiseSuppression: "toggle_noise_suppression",
  enumerateInputDevices: "enumerate_input_devices",
  enumerateOutputDevices: "enumerate_output_devices",
  enumerateAudioDevices: "enumerate_audio_devices",
  selectInputDevice: "select_input_device",
  selectOutputDevice: "select_output_device",
  joinConference: "join_conference",
  leaveConference: "leave_conference",
  sendVideoSignaling: "send_video_signaling",

  // logs
  writeAppLog: "write_app_log",
  readAppLogLines: "read_app_log_lines",

  // temp_file
  cleanupTempFiles: "cleanup_temp_files",
  removeTempFile: "remove_temp_file",
  saveTempFile: "save_temp_file",
  openTempFile: "open_temp_file",
} as const;

/**
 * Tauri 命令名联合类型（由 `TAURI_COMMANDS` 推导）。
 */
export type TauriCommandName = (typeof TAURI_COMMANDS)[keyof typeof TAURI_COMMANDS];
