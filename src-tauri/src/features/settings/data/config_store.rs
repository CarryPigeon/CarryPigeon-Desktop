//! settings｜数据层：config_store。
//!
//! 约定：注释中文，日志英文（tracing）。
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::any::TypeId;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;

const CONFIG_FILE: &str = "./config.json";

fn config_write_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn config_temp_path(path: &Path) -> PathBuf {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    path.with_extension(format!("tmp-{}-{}", std::process::id(), stamp))
}

#[cfg(windows)]
fn replace_file_windows(src: &Path, dst: &Path) -> std::io::Result<()> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    unsafe extern "system" {
        fn MoveFileExW(existing: *const u16, new: *const u16, flags: u32) -> i32;
    }

    const MOVEFILE_REPLACE_EXISTING: u32 = 0x1;
    const MOVEFILE_WRITE_THROUGH: u32 = 0x8;

    fn to_wide(value: &OsStr) -> Vec<u16> {
        let mut wide: Vec<u16> = value.encode_wide().collect();
        wide.push(0);
        wide
    }

    let src_wide = to_wide(src.as_os_str());
    let dst_wide = to_wide(dst.as_os_str());
    let ok = unsafe {
        MoveFileExW(
            src_wide.as_ptr(),
            dst_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if ok != 0 {
        return Ok(());
    }
    Err(std::io::Error::last_os_error())
}

async fn atomic_write_config(path: &Path, payload: &str) -> anyhow::Result<()> {
    let tmp = config_temp_path(path);
    let mut file = tokio::fs::File::create(&tmp)
        .await
        .map_err(|error| anyhow::anyhow!("Failed to create temp config file: {}", error))?;
    file.write_all(payload.as_bytes())
        .await
        .map_err(|error| anyhow::anyhow!("Failed to write temp config file: {}", error))?;
    file.sync_all()
        .await
        .map_err(|error| anyhow::anyhow!("Failed to sync temp config file: {}", error))?;
    drop(file);

    if tokio::fs::rename(&tmp, path).await.is_ok() {
        return Ok(());
    }
    #[cfg(windows)]
    {
        replace_file_windows(&tmp, path).map_err(|error| {
            anyhow::anyhow!("Failed to replace config via MoveFileExW: {}", error)
        })?;
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        Err(anyhow::anyhow!(
            "Failed to rename temp config file to target: {}",
            path.display()
        ))
    }
}

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
/// - 历史格式：`server_list` 元素为字符串（直接返回字符串值）；
/// - 对象格式：按类型提取明确字段，`String -> server_socket`、`u32/u64 -> server_port`、
///   `bool -> enabled/is_enabled/is_default/default`（若字段缺失则回退旧语义）。
pub async fn get_server_config_value<T>(server_socket: String) -> T
where
    T: ConfigValueExtractor<T> + Default + 'static,
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
                let matched = item
                    .as_object()
                    .and_then(|obj| obj.get("server_socket"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim() == want)
                    .unwrap_or(false)
                    || item.as_str().map(|s| s.trim() == want).unwrap_or(false);
                if matched {
                    if let Some(obj) = item.as_object() {
                        if let Some(extracted) = extract_server_object_value::<T>(obj) {
                            return extracted;
                        }
                    }
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

fn extract_server_object_value<T>(obj: &serde_json::Map<String, Value>) -> Option<T>
where
    T: ConfigValueExtractor<T> + Default + 'static,
{
    if TypeId::of::<T>() == TypeId::of::<String>() {
        return obj
            .get("server_socket")
            .or_else(|| obj.get("server_name"))
            .map(T::extract);
    }
    if TypeId::of::<T>() == TypeId::of::<u32>() || TypeId::of::<T>() == TypeId::of::<u64>() {
        return obj.get("server_port").map(T::extract);
    }
    if TypeId::of::<T>() == TypeId::of::<bool>() {
        return obj
            .get("enabled")
            .or_else(|| obj.get("is_enabled"))
            .or_else(|| obj.get("is_default"))
            .or_else(|| obj.get("default"))
            .map(T::extract);
    }
    None
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
pub async fn update_config<T>(key: String, value: T) -> anyhow::Result<()>
where
    T: ConfigValueExtractor<T> + Default,
{
    let _guard = config_write_lock().lock().await;
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
                return Err(anyhow::anyhow!("Failed to serialize config: {}", error));
            }
        };

        if let Err(error) = atomic_write_config(config_file, &data).await {
            tracing::error!(action = "settings_config_write_failed", path = CONFIG_FILE, error = %error);
            return Err(error);
        }
        Ok(())
    } else {
        tracing::error!(action = "settings_config_invalid_json_object");
        Err(anyhow::anyhow!("Invalid config JSON object"))
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
pub async fn update_config_bool(key: String, value: bool) -> anyhow::Result<()> {
    update_config::<bool>(key, value).await
}

/// 写入 u32 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
/// - `value`：要写入的 u32。
///
/// # 返回值
/// 无返回值。
pub async fn update_config_u32(key: String, value: u32) -> anyhow::Result<()> {
    update_config::<u32>(key, value).await
}

/// 写入 u64 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
/// - `value`：要写入的 u64。
///
/// # 返回值
/// 无返回值。
pub async fn update_config_u64(key: String, value: u64) -> anyhow::Result<()> {
    update_config::<u64>(key, value).await
}

/// 写入 string 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
/// - `value`：要写入的 string。
///
/// # 返回值
/// 无返回值。
pub async fn update_config_string(key: String, value: String) -> anyhow::Result<()> {
    update_config::<String>(key, value).await
}
