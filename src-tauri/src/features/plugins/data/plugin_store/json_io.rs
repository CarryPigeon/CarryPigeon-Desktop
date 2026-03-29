//! plugin_store｜JSON 文件读写（异步）。
//!
//! 说明：
//! - 该模块收敛“创建父目录 + 读写 JSON”的重复逻辑；
//! - 读取时对空文件做 `None` 处理，避免把空白当作 JSON 解析错误；
//! - 仅负责通用 IO，不承载插件领域语义。

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use anyhow::Context;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;
use tokio::sync::RwLock;

fn json_file_lock() -> &'static RwLock<()> {
    static LOCK: OnceLock<RwLock<()>> = OnceLock::new();
    LOCK.get_or_init(|| RwLock::new(()))
}

fn json_temp_path(path: &Path) -> PathBuf {
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

async fn replace_file_atomic(src: &Path, dst: &Path) -> anyhow::Result<()> {
    if tokio::fs::rename(src, dst).await.is_ok() {
        return Ok(());
    }
    #[cfg(windows)]
    {
        replace_file_windows(src, dst).with_context(|| {
            format!("Failed to replace file via MoveFileExW: {}", dst.display())
        })?;
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        Err(anyhow::anyhow!(
            "Failed to rename temp file to target: {}",
            dst.display()
        ))
    }
}

async fn ensure_dir(path: &Path) -> anyhow::Result<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .with_context(|| format!("Failed to create dir: {}", parent.display()))?;
    }
    Ok(())
}

pub(super) async fn read_json_file<T: for<'de> Deserialize<'de>>(
    path: &Path,
) -> anyhow::Result<Option<T>> {
    let _read_guard = json_file_lock().read().await;
    match tokio::fs::read_to_string(path).await {
        Ok(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                return Ok(None);
            }
            let parsed = serde_json::from_str::<T>(trimmed)
                .with_context(|| format!("Failed to parse JSON: {}", path.display()))?;
            Ok(Some(parsed))
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(err.into()),
    }
}

pub(super) async fn write_json_file<T: Serialize>(path: &Path, value: &T) -> anyhow::Result<()> {
    let _write_guard = json_file_lock().write().await;
    ensure_dir(path).await?;
    let payload = serde_json::to_string_pretty(value).context("Failed to serialize JSON")?;
    let temp_path = json_temp_path(path);
    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .with_context(|| format!("Failed to create temp file: {}", temp_path.display()))?;
    file.write_all(payload.as_bytes())
        .await
        .with_context(|| format!("Failed to write temp file: {}", temp_path.display()))?;
    file.sync_all()
        .await
        .with_context(|| format!("Failed to sync temp file: {}", temp_path.display()))?;
    drop(file);

    replace_file_atomic(&temp_path, path).await?;
    Ok(())
}
