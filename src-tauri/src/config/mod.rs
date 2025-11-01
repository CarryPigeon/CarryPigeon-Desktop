use serde::{Deserialize, Serialize};
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
