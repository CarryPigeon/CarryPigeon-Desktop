use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{io::Write, path::Path};

/// 异步获取配置文件内容
///
/// 该函数读取当前目录下的config文件，将其解析为JSON格式并返回
///
/// # Returns
/// * `anyhow::Result<Value>` - 返回解析后的JSON配置数据，如果读取或解析失败则返回错误
///
/// # Errors
/// 当文件读取失败或JSON解析失败时会返回相应的错误
#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub server_socket: String,
    pub server_port: u16,
    pub server_name: String,
    pub account: String,
    pub user_name: String,
    pub user_avatar: String,
}
#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub auto_login: bool,
    pub auto_launch: bool,
    pub close_to_tray: bool,
    pub check_for_updates: bool,
    pub server_list: Vec<ServerConfig>,
}

#[tauri::command]
pub async fn get_config() -> String {
    // 读取配置文件内容
    let config_file = Path::new("./config.json");
    let data = Box::new(tokio::fs::read_to_string(config_file).await);
    match *data {
        Ok(data) => {
            if data.is_empty() {
                let mut file = std::fs::File::create(config_file).unwrap();
                file.write_all(
                    serde_json::to_string(&Config::default())
                        .unwrap()
                        .as_bytes(),
                )
                .unwrap();
            }
            data
        }
        Err(_) => {
            let mut file = std::fs::File::create(config_file).unwrap();
            file.write_all(
                serde_json::to_string(&Config::default())
                    .unwrap()
                    .as_bytes(),
            )
            .unwrap();
            serde_json::to_string(&Config::default()).unwrap()
        }
    }
}

pub trait ConfigValueExtractor<T> {
    fn extract(value: &Value) -> T;
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

/// 异步获取配置文件中的值
///
/// 该函数读取配置文件中的指定键值，并返回对应的值
///
/// # Returns
/// * `T` - 返回查找的值，如果找不到则返回默认值
///
/// # Errors
/// 当文件读取失败或JSON解析失败时会返回相应的错误
/// 当键值不存在时会返回默认值
pub async fn get_config_value<T>(key: String) -> T
where
    T: ConfigValueExtractor<T> + Default,
{
    let config_str = get_config().await;
    let value = serde_json::from_str(&config_str).unwrap_or_else(|e| {
        tracing::error!("Failed to parse config file: {}", e);
        Value::Null
    });
    if let Value::Object(map) = value {
        map.get(&key)
            .map(|v| T::extract(v))
            .unwrap_or_else(|| T::default())
    } else {
        tracing::error!("Config file is not a valid JSON object");
        T::default()
    }
}

/// 异步获取服务器配置
///
/// 该函数读取配置文件中的server_list数组，根据server_socket查找对应的服务器配置并返回
///
/// # Returns
/// * `T` - 返回查找的服务器配置，如果找不到则返回默认值
///
/// # Errors
/// 当文件读取失败或JSON解析失败时会返回相应的错误
/// 当服务器配置不存在时会返回默认值
pub async fn get_server_config_value<T>(server_socket: String) -> T
where
    T: ConfigValueExtractor<T> + Default,
{
    let config_str = get_config().await;
    let value = serde_json::from_str(&config_str).unwrap_or_else(|e| {
        tracing::error!("Failed to parse config file: {}", e);
        Value::Null
    });
    if let Value::Object(map) = value {
        map.get("server_list")
            .map(|v| {
                v.as_array()
                    .unwrap()
                    .iter()
                    .find(|v| v.as_str().unwrap() == server_socket)
                    .map(|v| T::extract(v))
                    .unwrap_or_else(|| T::default())
            })
            .unwrap_or_else(|| T::default())
    } else {
        tracing::error!("Config file is not a valid JSON object");
        T::default()
    }
}

pub async fn update_config<T>(key: String, value: T)
where
    T: ConfigValueExtractor<T> + Default,
{
    tracing::info!("update_config");
    let config_str = get_config().await;
    let mut config_value = serde_json::from_str(&config_str).unwrap_or_else(|e| {
        tracing::error!("Failed to parse config file: {}", e);
        Value::Null
    });
    if let Value::Object(ref mut map) = config_value {
        map.insert(key, value.into_json());
        let config_file = Path::new("./config.json");
        let mut file = std::fs::File::create(config_file).unwrap();
        file.write_all(
            serde_json::to_string_pretty(&config_value)
                .unwrap()
                .as_bytes(),
        )
        .unwrap_or_else(|e| {
            tracing::error!("Failed to write config file, info: {e}");
        });
    } else {
        tracing::error!("Config file is not a valid JSON object");
    }
}

#[tauri::command]
pub async fn get_config_bool(key: String) -> bool {
    get_config_value::<bool>(key).await
}

#[tauri::command]
pub async fn get_config_u32(key: String) -> u32 {
    get_config_value::<u32>(key).await
}

#[tauri::command]
pub async fn get_config_u64(key: String) -> u64 {
    get_config_value::<u64>(key).await
}

#[tauri::command]
pub async fn get_config_string(key: String) -> String {
    get_config_value::<String>(key).await
}

#[tauri::command]
pub async fn get_server_config_string(server_socket: String) -> String {
    get_server_config_value::<String>(server_socket).await
}

#[tauri::command]
pub async fn get_server_config_u32(server_socket: String) -> u32 {
    get_server_config_value::<u32>(server_socket).await
}

#[tauri::command]
pub async fn get_server_config_u64(server_socket: String) -> u64 {
    get_server_config_value::<u64>(server_socket).await
}

#[tauri::command]
pub async fn get_server_config_bool(server_socket: String) -> bool {
    get_server_config_value::<bool>(server_socket).await
}

#[tauri::command]
pub async fn update_config_bool(key: String, value: bool) {
    update_config::<bool>(key, value).await;
}

#[tauri::command]
pub async fn update_config_u32(key: String, value: u32) {
    update_config::<u32>(key, value).await;
}

#[tauri::command]
pub async fn update_config_u64(key: String, value: u64) {
    update_config::<u64>(key, value).await;
}

#[tauri::command]
pub async fn update_config_string(key: String, value: String) {
    update_config::<String>(key, value).await;
}
