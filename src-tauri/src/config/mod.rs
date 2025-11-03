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
pub struct Config {
    pub socket: String,
    pub port: u16,
}

#[tauri::command]
pub async fn get_config() -> String {
    // 读取配置文件内容
    let config_file = Path::new("./config");
    let data = Box::new(tokio::fs::read_to_string(config_file).await);
    match *data {
        Ok(data) => data,
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

pub async fn get_config_value(key: &str) -> Value{
    let config_str = get_config().await;
    let value = serde_json::from_str(&config_str).unwrap();
    if let Value::Object(map) = value {
        map.get(key).cloned().unwrap_or(Value::Null)
    } else {
        Value::Null
    }
}

pub async fn get_config_value_as_u32(key: &str) -> u32 {
    let config_str = get_config().await;
    let value = serde_json::from_str(&config_str).unwrap();
    if let Value::Object(map) = value {
        map.get(key).and_then(|v| v.as_number()).map(|n| n.as_u64().unwrap_or(0) as u32).unwrap_or(0)
    } else {
        0
    }
}

pub async fn get_config_value_as_u64(key: &str) -> u64 {
    let config_str = get_config().await;
    let value = serde_json::from_str(&config_str).unwrap();
    if let Value::Object(map) = value {
        map.get(key).and_then(|v| v.as_number()).map(|n| n.as_u64().unwrap_or(0)).unwrap_or(0)
    } else {
        0
    }
}

pub async fn get_config_value_as_string(key: &str) -> String {
    let config_str = get_config().await;
    let value = serde_json::from_str(&config_str).unwrap();
    if let Value::Object(map) = value {
        map.get(key).and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_default()
    } else {
        String::new()
    }
}

pub async fn get_config_value_as_bool(key: &str) -> bool {
    let config_str = get_config().await;
    let value = serde_json::from_str(&config_str).unwrap();
    if let Value::Object(map) = value {
        map.get(key).and_then(|v| v.as_bool()).unwrap_or(false)
    } else {
        false
    }
}