//! settings｜数据层：config_store。
//!
//! 约定：注释中文，日志英文（tracing）。
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;

const CONFIG_FILE: &str = "./config.json";

fn default_config_json() -> String {
    serde_json::to_string(&Config::default()).unwrap_or_else(|error| {
        tracing::error!(action = "settings_config_default_serialize_failed", error = %error);
        "{}".to_string()
    })
}

async fn ensure_config_file_exists() -> String {
    let config_file = Path::new(CONFIG_FILE);
    let default_json = default_config_json();

    match tokio::fs::write(config_file, &default_json).await {
        Ok(_) => {
            tracing::info!(
                action = "settings_config_file_initialized",
                path = CONFIG_FILE
            );
            default_json
        }
        Err(error) => {
            tracing::error!(
                action = "settings_config_file_initialize_failed",
                path = CONFIG_FILE,
                error = %error
            );
            default_json
        }
    }
}

/// 单个服务器配置条目（用于本地配置文件持久化）。
#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    /// 服务器 socket 地址（例如 `socket://host:port` 或 `https://...`）。
    pub server_socket: String,
    /// 服务器端口（历史字段，可能与 socket 重复）。
    pub server_port: u16,
    /// 服务器展示名称。
    pub server_name: String,
    /// 账号（历史字段/预留）。
    pub account: String,
    /// 用户名（历史字段/预留）。
    pub user_name: String,
    /// 用户头像（历史字段/预留）。
    pub user_avatar: String,
}

/// 应用配置文件结构（`config.json`）。
#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// 是否自动登录。
    pub auto_login: bool,
    /// 是否开机自启。
    pub auto_launch: bool,
    /// 关闭窗口时是否最小化到托盘。
    pub close_to_tray: bool,
    /// 是否自动检查更新。
    pub check_for_updates: bool,
    /// 服务器列表（历史字段）。
    pub server_list: Vec<ServerConfig>,
}

/// 读取（或初始化）配置文件内容。
///
/// # 返回值
/// - 返回原始 JSON 字符串；若文件不存在或为空，会自动写入默认配置并返回默认值。
pub async fn get_config() -> String {
    let config_file = Path::new(CONFIG_FILE);
    match tokio::fs::read_to_string(config_file).await {
        Ok(data) => {
            if data.is_empty() {
                tracing::warn!(action = "settings_config_file_empty", path = CONFIG_FILE);
                return ensure_config_file_exists().await;
            }
            data
        }
        Err(error) => {
            tracing::warn!(
                action = "settings_config_file_read_failed",
                path = CONFIG_FILE,
                error = %error
            );
            ensure_config_file_exists().await
        }
    }
}

/// 配置值抽取器：将 JSON 值转换为指定类型，并支持反向写回 JSON。
///
/// # 说明
/// - `extract`：从 `serde_json::Value` 中提取目标类型；
/// - `into_json`：将目标类型转换为可写入配置文件的 JSON 值。
pub trait ConfigValueExtractor<T> {
    /// 从 JSON 值中提取类型 `T`。
    fn extract(value: &Value) -> T;
    /// 将当前值转换为 JSON，以便写入配置文件。
    fn into_json(self) -> Value;
}

impl ConfigValueExtractor<u32> for u32 {
    fn extract(value: &Value) -> u32 {
        value.as_number().and_then(|v| v.as_u64()).unwrap_or(0) as u32
    }
    fn into_json(self) -> Value {
        Value::Number(serde_json::Number::from(self))
    }
}

impl ConfigValueExtractor<u64> for u64 {
    fn extract(value: &Value) -> u64 {
        value.as_number().and_then(|v| v.as_u64()).unwrap_or(0)
    }
    fn into_json(self) -> Value {
        Value::Number(serde_json::Number::from(self))
    }
}

impl ConfigValueExtractor<String> for String {
    fn extract(value: &Value) -> String {
        value.as_str().unwrap_or("").to_string()
    }
    fn into_json(self) -> Value {
        Value::String(self)
    }
}

impl ConfigValueExtractor<bool> for bool {
    fn extract(value: &Value) -> bool {
        value.as_bool().unwrap_or(false)
    }
    fn into_json(self) -> Value {
        Value::Bool(self)
    }
}

/// 异步读取配置文件中的指定键值。
///
/// # 参数
/// - `key`：配置键名（顶层字段）。
///
/// # 返回值
/// - 返回提取后的值；缺失/非法时返回默认值。
pub async fn get_config_value<T>(key: String) -> T
where
    T: ConfigValueExtractor<T> + Default,
{
    let config_str = get_config().await;
    let value = serde_json::from_str(&config_str).unwrap_or_else(|e| {
        tracing::error!(action = "settings_config_parse_failed", error = %e);
        Value::Null
    });
    if let Value::Object(map) = value {
        map.get(&key)
            .map(|v| T::extract(v))
            .unwrap_or_else(|| T::default())
    } else {
        tracing::error!(action = "settings_config_invalid_json_object");
        T::default()
    }
}

/// 异步读取配置文件中的 server_list，并按 server_socket 匹配返回对应条目。
///
/// # 参数
/// - `server_socket`：服务端 socket（用于匹配 server_list 中的条目）。
///
/// # 返回值
/// - 返回提取后的值；缺失/非法时返回默认值。
///
/// # 说明
/// - 当前实现约定 `server_list` 的元素为字符串（历史格式）。若元素不是字符串，将返回默认值而不是 panic；
/// - 若未来需要支持对象结构（`ServerConfig`），建议新增专用 API（例如 `get_server_config`）而不是复用该泛型函数。
pub async fn get_server_config_value<T>(server_socket: String) -> T
where
    T: ConfigValueExtractor<T> + Default,
{
    let config_str = get_config().await;
    let value = serde_json::from_str(&config_str).unwrap_or_else(|e| {
        tracing::error!(action = "settings_config_parse_failed", error = %e);
        Value::Null
    });
    if let Value::Object(map) = value {
        let want = server_socket.trim();
        let list = map.get("server_list").and_then(|v| v.as_array());
        if let Some(list) = list {
            for item in list.iter() {
                if item.as_str().map(|s| s.trim() == want).unwrap_or(false) {
                    return T::extract(item);
                }
            }
        }
        T::default()
    } else {
        tracing::error!(action = "settings_config_invalid_json_object");
        T::default()
    }
}

/// 异步更新配置文件中的指定键值（写回 `config.json`）。
///
/// # 参数
/// - `key`：配置键名（顶层字段）。
/// - `value`：要写入的值（会通过 `ConfigValueExtractor::into_json` 转换为 JSON）。
///
/// # 返回值
/// 无返回值。
///
/// # 说明
/// - 若配置文件解析失败，会记录错误日志并放弃写入；
/// - 该函数使用 pretty JSON 写回，便于人工排查与版本管理。
pub async fn update_config<T>(key: String, value: T)
where
    T: ConfigValueExtractor<T> + Default,
{
    tracing::info!(action = "settings_config_updated", key = %key);
    let config_str = get_config().await;
    let mut config_value = serde_json::from_str(&config_str).unwrap_or_else(|e| {
        tracing::error!(action = "settings_config_parse_failed", error = %e);
        Value::Null
    });
    if let Value::Object(ref mut map) = config_value {
        map.insert(key, value.into_json());
        let config_file = Path::new(CONFIG_FILE);
        let data = match serde_json::to_string_pretty(&config_value) {
            Ok(serialized) => serialized,
            Err(error) => {
                tracing::error!(action = "settings_config_serialize_failed", error = %error);
                return;
            }
        };

        if let Err(error) = tokio::fs::write(config_file, data).await {
            tracing::error!(
                action = "settings_config_write_failed",
                path = CONFIG_FILE,
                error = %error
            );
        }
    } else {
        tracing::error!(action = "settings_config_invalid_json_object");
    }
}

/// 读取 bool 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 bool；缺失/非法时返回默认值（false）。
pub async fn get_config_bool(key: String) -> bool {
    get_config_value::<bool>(key).await
}

/// 读取 u32 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 u32；缺失/非法时返回默认值（0）。
pub async fn get_config_u32(key: String) -> u32 {
    get_config_value::<u32>(key).await
}

/// 读取 u64 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 u64；缺失/非法时返回默认值（0）。
pub async fn get_config_u64(key: String) -> u64 {
    get_config_value::<u64>(key).await
}

/// 读取 string 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 string；缺失/非法时返回默认值（空字符串）。
pub async fn get_config_string(key: String) -> String {
    get_config_value::<String>(key).await
}

/// 读取与 server_socket 相关的 string 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 string；缺失/非法时返回默认值（空字符串）。
pub async fn get_server_config_string(server_socket: String) -> String {
    get_server_config_value::<String>(server_socket).await
}

/// 读取与 server_socket 相关的 u32 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 u32；缺失/非法时返回默认值（0）。
pub async fn get_server_config_u32(server_socket: String) -> u32 {
    get_server_config_value::<u32>(server_socket).await
}

/// 读取与 server_socket 相关的 u64 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 u64；缺失/非法时返回默认值（0）。
pub async fn get_server_config_u64(server_socket: String) -> u64 {
    get_server_config_value::<u64>(server_socket).await
}

/// 读取与 server_socket 相关的 bool 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 bool；缺失/非法时返回默认值（false）。
pub async fn get_server_config_bool(server_socket: String) -> bool {
    get_server_config_value::<bool>(server_socket).await
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
    update_config::<bool>(key, value).await;
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
    update_config::<u32>(key, value).await;
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
    update_config::<u64>(key, value).await;
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
    update_config::<String>(key, value).await;
}
