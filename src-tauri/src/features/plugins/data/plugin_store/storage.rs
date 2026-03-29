//! plugin_store｜插件侧 KV 存储（storage.json）。
//!
//! 说明：
//! - 插件需要一个简单的“持久化小存储”能力，便于保存用户偏好/运行时状态；
//! - 这里采用每个插件一个 `storage.json` 的方式（按 server_id 隔离）。

use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tokio::io::AsyncWriteExt;
use tokio::sync::RwLock;

use super::{api::fetch_server_id, origin::to_http_origin, paths::storage_file_path};

fn storage_file_lock() -> &'static RwLock<()> {
    static LOCK: OnceLock<RwLock<()>> = OnceLock::new();
    LOCK.get_or_init(|| RwLock::new(()))
}

fn storage_temp_path(path: &Path) -> PathBuf {
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

async fn atomic_write(path: &Path, out: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .with_context(|| format!("Failed to create dir: {}", parent.display()))?;
    }

    let temp_path = storage_temp_path(path);
    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .with_context(|| format!("Failed to create temp file: {}", temp_path.display()))?;
    file.write_all(out.as_bytes())
        .await
        .with_context(|| format!("Failed to write temp file: {}", temp_path.display()))?;
    file.sync_all()
        .await
        .with_context(|| format!("Failed to sync temp file: {}", temp_path.display()))?;
    drop(file);

    if tokio::fs::rename(&temp_path, path).await.is_err() {
        #[cfg(windows)]
        {
            replace_file_windows(&temp_path, path).with_context(|| {
                format!("Failed to replace file via MoveFileExW: {}", path.display())
            })?;
        }
        #[cfg(not(windows))]
        {
            return Err(anyhow::anyhow!(
                "Failed to rename temp file to target: {}",
                path.display()
            ));
        }
    }
    Ok(())
}

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
    let server_id = fetch_server_id(&origin, tls_policy, tls_fingerprint).await?;
    let path = storage_file_path(&server_id, plugin_id)?;
    let _read_guard = storage_file_lock().read().await;
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
    let server_id = fetch_server_id(&origin, tls_policy, tls_fingerprint).await?;
    let path = storage_file_path(&server_id, plugin_id)?;
    let _write_guard = storage_file_lock().write().await;
    let mut map: serde_json::Map<String, serde_json::Value> =
        match tokio::fs::read_to_string(&path).await {
            Ok(v) => serde_json::from_str(&v).context("Invalid storage.json")?,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => serde_json::Map::new(),
            Err(e) => return Err(e.into()),
        };
    map.insert(key.to_string(), value);
    let out = serde_json::to_string_pretty(&map).context("Failed to serialize storage")?;
    atomic_write(&path, &out).await?;
    Ok(())
}
