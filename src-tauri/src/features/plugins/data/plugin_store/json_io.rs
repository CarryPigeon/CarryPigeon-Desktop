//! plugin_store｜JSON 文件读写（异步）。
//!
//! 说明：
//! - 该模块收敛“创建父目录 + 读写 JSON”的重复逻辑；
//! - 读取时对空文件做 `None` 处理，避免把空白当作 JSON 解析错误；
//! - 仅负责通用 IO，不承载插件领域语义。

use std::path::Path;

use anyhow::Context;
use serde::{Deserialize, Serialize};

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
    ensure_dir(path).await?;
    let s = serde_json::to_string_pretty(value).context("Failed to serialize JSON")?;
    tokio::fs::write(path, s)
        .await
        .with_context(|| format!("Failed to write file: {}", path.display()))?;
    Ok(())
}
