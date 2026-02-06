//! plugin_store｜插件侧 KV 存储（storage.json）。
//!
//! 说明：
//! - 插件需要一个简单的“持久化小存储”能力，便于保存用户偏好/运行时状态；
//! - 这里采用每个插件一个 `storage.json` 的方式（按 server_id 隔离）。

use anyhow::{Context, Result};

use super::{
    api::fetch_server_id, origin::to_http_origin, paths::storage_file_path,
    tls::build_server_client,
};

/// 读取插件 KV 存储中的某个键值。
///
/// # 参数
/// - `server_socket`：服务端 socket（用于解析 origin 并获取 server_id）。
/// - `plugin_id`：插件 id。
/// - `key`：要读取的 key。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(Some(Value))`：存在该 key，返回对应 JSON 值。
/// - `Ok(None)`：storage.json 不存在或 key 不存在。
/// - `Err(anyhow::Error)`：读取/解析失败原因。
///
/// # 说明
/// - 存储文件路径为 `data/plugins/{server_id}/{plugin_id}/storage.json`（由 paths 子模块决定）。
pub async fn storage_get(
    server_socket: &str,
    plugin_id: &str,
    key: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> Result<Option<serde_json::Value>> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    let path = storage_file_path(&server_id, plugin_id)?;
    let raw = match tokio::fs::read_to_string(&path).await {
        Ok(v) => v,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.into()),
    };
    let map: serde_json::Map<String, serde_json::Value> =
        serde_json::from_str(&raw).context("Invalid storage.json")?;
    Ok(map.get(key).cloned())
}

/// 写入插件 KV 存储中的某个键值。
///
/// # 参数
/// - `server_socket`：服务端 socket。
/// - `plugin_id`：插件 id。
/// - `key`：要写入的 key。
/// - `value`：要写入的 JSON 值。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(())`：写入成功。
/// - `Err(anyhow::Error)`：读取/写入失败原因。
///
/// # 说明
/// - 若 storage.json 不存在，会创建一个新的 map；
/// - 写回时使用 pretty JSON，便于排查与调试。
pub async fn storage_set(
    server_socket: &str,
    plugin_id: &str,
    key: &str,
    value: serde_json::Value,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> Result<()> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    let path = storage_file_path(&server_id, plugin_id)?;
    let mut map: serde_json::Map<String, serde_json::Value> =
        match tokio::fs::read_to_string(&path).await {
            Ok(v) => serde_json::from_str(&v).context("Invalid storage.json")?,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => serde_json::Map::new(),
            Err(e) => return Err(e.into()),
        };
    map.insert(key.to_string(), value);
    let out = serde_json::to_string_pretty(&map).context("Failed to serialize storage")?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .with_context(|| format!("Failed to create dir: {}", parent.display()))?;
    }
    tokio::fs::write(&path, out)
        .await
        .with_context(|| format!("Failed to write: {}", path.display()))?;
    Ok(())
}
