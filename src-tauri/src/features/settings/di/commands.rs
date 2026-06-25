//! settings｜DI/命令入口：commands。
//!
//! 约定：注释中文，日志英文（tracing）。
//!
//! 本模块仅做参数透传 + 错误规范化。
//! close_to_tray 的缓存同步已下沉到 ConfigStorePortAdapter（data 层）。

use crate::features::settings::data::config_store_port_adapter::ConfigStorePortAdapter;
use crate::features::settings::usecases::config_usecases;
use crate::shared::error::{CommandResult, to_command_error};

/// 获取应用配置文件的原始 JSON 字符串。
///
/// # 返回值
/// 返回配置文件内容；若文件不存在会自动初始化为默认配置并返回默认值。
#[tauri::command]
pub async fn get_config() -> CommandResult<String> {
    config_usecases::get_config(ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_GET_CONFIG_FAILED",
                "error.settings_get_config_failed",
                e,
            )
        })
}

/// 导出版本化 settings envelope。
#[tauri::command]
pub async fn export_settings() -> CommandResult<String> {
    config_usecases::export_settings(ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_EXPORT_SETTINGS_FAILED",
                "error.settings_export_settings_failed",
                e,
            )
        })
}

/// 导入版本化 settings envelope。
///
/// close_to_tray 缓存同步已下沉到 ConfigStorePortAdapter（data 层）。
#[tauri::command]
pub async fn import_settings(raw: String) -> CommandResult<()> {
    config_usecases::import_settings(raw, ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_IMPORT_SETTINGS_FAILED",
                "error.settings_import_settings_failed",
                e,
            )
        })
}

/// 重置 settings 到默认值。
///
/// close_to_tray 缓存同步已下沉到 ConfigStorePortAdapter（data 层）。
#[tauri::command]
pub async fn reset_settings() -> CommandResult<()> {
    config_usecases::reset_settings(ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_RESET_SETTINGS_FAILED",
                "error.settings_reset_settings_failed",
                e,
            )
        })
}

/// 读取 bool 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 bool；缺失/非法时返回默认值（false）。
#[tauri::command]
pub async fn get_config_bool(key: String) -> CommandResult<bool> {
    config_usecases::get_config_bool(key, ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_GET_CONFIG_BOOL_FAILED",
                "error.settings_get_config_bool_failed",
                e,
            )
        })
}

/// 读取 u32 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 u32；缺失/非法时返回默认值（0）。
#[tauri::command]
pub async fn get_config_u32(key: String) -> CommandResult<u32> {
    config_usecases::get_config_u32(key, ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_GET_CONFIG_U32_FAILED",
                "error.settings_get_config_u32_failed",
                e,
            )
        })
}

/// 读取 u64 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 u64；缺失/非法时返回默认值（0）。
#[tauri::command]
pub async fn get_config_u64(key: String) -> CommandResult<u64> {
    config_usecases::get_config_u64(key, ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_GET_CONFIG_U64_FAILED",
                "error.settings_get_config_u64_failed",
                e,
            )
        })
}

/// 读取 string 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 string；缺失/非法时返回默认值（空字符串）。
#[tauri::command]
pub async fn get_config_string(key: String) -> CommandResult<String> {
    config_usecases::get_config_string(key, ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_GET_CONFIG_STRING_FAILED",
                "error.settings_get_config_string_failed",
                e,
            )
        })
}

/// 读取与 server_socket 相关的 string 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 string；缺失/非法时返回默认值（空字符串）。
#[tauri::command]
pub async fn get_server_config_string(server_socket: String) -> CommandResult<String> {
    config_usecases::get_server_config_string(server_socket, ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_GET_SERVER_CONFIG_STRING_FAILED",
                "error.settings_get_server_config_string_failed",
                e,
            )
        })
}

/// 读取与 server_socket 相关的 u32 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 u32；缺失/非法时返回默认值（0）。
#[tauri::command]
pub async fn get_server_config_u32(server_socket: String) -> CommandResult<u32> {
    config_usecases::get_server_config_u32(server_socket, ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_GET_SERVER_CONFIG_U32_FAILED",
                "error.settings_get_server_config_u32_failed",
                e,
            )
        })
}

/// 读取与 server_socket 相关的 u64 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 u64；缺失/非法时返回默认值（0）。
#[tauri::command]
pub async fn get_server_config_u64(server_socket: String) -> CommandResult<u64> {
    config_usecases::get_server_config_u64(server_socket, ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_GET_SERVER_CONFIG_U64_FAILED",
                "error.settings_get_server_config_u64_failed",
                e,
            )
        })
}

/// 读取与 server_socket 相关的 bool 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 bool；缺失/非法时返回默认值（false）。
#[tauri::command]
pub async fn get_server_config_bool(server_socket: String) -> CommandResult<bool> {
    config_usecases::get_server_config_bool(server_socket, ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_GET_SERVER_CONFIG_BOOL_FAILED",
                "error.settings_get_server_config_bool_failed",
                e,
            )
        })
}

/// 写入 bool 类型配置值（顶层字段）。
///
/// close_to_tray 缓存同步已下沉到 ConfigStorePortAdapter（data 层）。
///
/// # 参数
/// - `key`：配置键名。
/// - `value`：要写入的 bool。
///
/// # 返回值
/// 无返回值。
#[tauri::command]
pub async fn update_config_bool(key: String, value: bool) -> CommandResult<()> {
    config_usecases::update_config_bool(key, value, ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_UPDATE_CONFIG_BOOL_FAILED",
                "error.settings_update_config_bool_failed",
                e,
            )
        })
}

/// 写入 u32 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
/// - `value`：要写入的 u32。
///
/// # 返回值
/// 无返回值。
#[tauri::command]
pub async fn update_config_u32(key: String, value: u32) -> CommandResult<()> {
    config_usecases::update_config_u32(key, value, ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_UPDATE_CONFIG_U32_FAILED",
                "error.settings_update_config_u32_failed",
                e,
            )
        })
}

/// 写入 u64 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
/// - `value`：要写入的 u64。
///
/// # 返回值
/// 无返回值。
/// 写入 string 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
/// - `value`：要写入的 string。
///
/// # 返回值
/// 无返回值。
#[tauri::command]
pub async fn update_config_string(key: String, value: String) -> CommandResult<()> {
    config_usecases::update_config_string(key, value, ConfigStorePortAdapter::shared())
        .await
        .map_err(|e| {
            to_command_error(
                "SETTINGS_UPDATE_CONFIG_STRING_FAILED",
                "error.settings_update_config_string_failed",
                e,
            )
        })
}
