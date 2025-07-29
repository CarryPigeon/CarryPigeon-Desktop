use serde_json::Value;
use std::path::Path;

/// 异步获取配置文件内容
///
/// 该函数读取当前目录下的config文件，将其解析为JSON格式并返回
///
/// # Returns
/// * `anyhow::Result<Value>` - 返回解析后的JSON配置数据，如果读取或解析失败则返回错误
///
/// # Errors
/// 当文件读取失败或JSON解析失败时会返回相应的错误
pub async fn get_config() -> anyhow::Result<Value> {
    // 读取配置文件内容
    let config_file = Path::new("./config");
    let data = Box::new(tokio::fs::read_to_string(config_file).await?);
    // 将字符串数据解析为HashMap并返回
    Ok(serde_json::from_str(&data)?)
}
