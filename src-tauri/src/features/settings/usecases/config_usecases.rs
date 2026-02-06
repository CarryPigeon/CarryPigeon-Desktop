//! settings｜用例层：config_usecases。
//!
//! 约定：注释中文，日志英文（tracing）。
use crate::features::settings::data::config_store;

/// 获取应用配置文件的原始 JSON 字符串。
///
/// # 返回值
/// 返回配置文件内容；若文件不存在会自动初始化为默认配置并返回默认值。
pub async fn get_config() -> String {
    config_store::get_config().await
}

/// 读取 bool 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 bool；缺失/非法时返回默认值（false）。
pub async fn get_config_bool(key: String) -> bool {
    config_store::get_config_bool(key).await
}

/// 读取 u32 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 u32；缺失/非法时返回默认值（0）。
pub async fn get_config_u32(key: String) -> u32 {
    config_store::get_config_u32(key).await
}

/// 读取 u64 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 u64；缺失/非法时返回默认值（0）。
pub async fn get_config_u64(key: String) -> u64 {
    config_store::get_config_u64(key).await
}

/// 读取 string 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 string；缺失/非法时返回默认值（空字符串）。
pub async fn get_config_string(key: String) -> String {
    config_store::get_config_string(key).await
}

/// 读取与 server_socket 相关的 string 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 string；缺失/非法时返回默认值（空字符串）。
pub async fn get_server_config_string(server_socket: String) -> String {
    config_store::get_server_config_string(server_socket).await
}

/// 读取与 server_socket 相关的 u32 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 u32；缺失/非法时返回默认值（0）。
pub async fn get_server_config_u32(server_socket: String) -> u32 {
    config_store::get_server_config_u32(server_socket).await
}

/// 读取与 server_socket 相关的 u64 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 u64；缺失/非法时返回默认值（0）。
pub async fn get_server_config_u64(server_socket: String) -> u64 {
    config_store::get_server_config_u64(server_socket).await
}

/// 读取与 server_socket 相关的 bool 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 bool；缺失/非法时返回默认值（false）。
pub async fn get_server_config_bool(server_socket: String) -> bool {
    config_store::get_server_config_bool(server_socket).await
}

/// 写入 bool 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
/// - `value`：要写入的 bool。
///
/// # 返回值
/// 无返回值。
pub async fn update_config_bool(key: String, value: bool) {
    config_store::update_config_bool(key, value).await;
}

/// 写入 u32 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
/// - `value`：要写入的 u32。
///
/// # 返回值
/// 无返回值。
pub async fn update_config_u32(key: String, value: u32) {
    config_store::update_config_u32(key, value).await;
}

/// 写入 u64 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
/// - `value`：要写入的 u64。
///
/// # 返回值
/// 无返回值。
pub async fn update_config_u64(key: String, value: u64) {
    config_store::update_config_u64(key, value).await;
}

/// 写入 string 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
/// - `value`：要写入的 string。
///
/// # 返回值
/// 无返回值。
pub async fn update_config_string(key: String, value: String) {
    config_store::update_config_string(key, value).await;
}
