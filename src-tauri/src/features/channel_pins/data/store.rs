//! channel_pins｜数据层：本地 JSON 持久化与热加载监听。
//!
//! 文件位置：`{app_data_dir}/channel-pins.json`
//! 热加载：后台任务按固定间隔轮询文件指纹，变化后解析并向前端广播事件。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::Duration;

use anyhow::{Context, Result};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex as TokioMutex;

use crate::features::channel_pins::domain::model::ChannelPinsStateV1;

/// Rust -> 前端事件名：置顶频道本地文件发生变化。
pub const CHANNEL_PINS_CHANGED_EVENT: &str = "channel-pins-changed";

/// 热加载轮询间隔（毫秒）。
const WATCH_POLL_INTERVAL: Duration = Duration::from_millis(1200);

static WRITE_LOCK: OnceLock<TokioMutex<()>> = OnceLock::new();

fn write_lock() -> &'static TokioMutex<()> {
    WRITE_LOCK.get_or_init(|| TokioMutex::new(()))
}

/// 返回置顶频道 JSON 文件路径。
///
/// 优先通过 `app_data_dir` 解析；未初始化时回退到 `"./channel-pins.json"`（开发/测试兼容）。
pub fn pins_file_path() -> PathBuf {
    crate::shared::app_data_dir::get_app_data_dir()
        .map(|dir| dir.join("channel-pins.json"))
        .unwrap_or_else(|_| PathBuf::from("./channel-pins.json"))
}

fn temp_path(path: &Path) -> PathBuf {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    path.with_extension(format!("tmp-{}-{}", std::process::id(), stamp))
}

/// 原子写入：先写临时文件，再重命名覆盖目标，避免读取到半成品内容。
fn atomic_write_blocking(path: &Path, payload: &str) -> Result<()> {
    let tmp = temp_path(path);
    std::fs::write(&tmp, payload).context("write channel pins temp file")?;
    if std::fs::rename(&tmp, path).is_ok() {
        return Ok(());
    }
    // Windows 下目标已存在时 rename 会失败，退化为先删后改名。
    if path.exists() {
        std::fs::remove_file(path).context("remove stale channel pins file")?;
    }
    std::fs::rename(&tmp, path).context("rename channel pins file")?;
    Ok(())
}

/// 读取置顶状态。
///
/// 文件缺失、处于写入中间态或解析失败时返回 `None`，
/// 调用方应保留最后一次已知状态，避免瞬时清空 UI。
pub fn load_state() -> Option<ChannelPinsStateV1> {
    let path = pins_file_path();
    let raw = std::fs::read_to_string(&path).ok()?;
    match serde_json::from_str::<ChannelPinsStateV1>(&raw) {
        Ok(state) => Some(state),
        Err(error) => {
            tracing::warn!(
                action = "app_channel_pins_parse_failed",
                path = %path.display(),
                error = %error
            );
            None
        }
    }
}

async fn save_state(state: &ChannelPinsStateV1) -> Result<()> {
    let _guard = write_lock().lock().await;
    let path = pins_file_path();
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .context("create channel pins dir")?;
    }
    let payload = serde_json::to_string_pretty(state).context("serialize channel pins")?;
    let write_path = path.clone();
    tokio::task::spawn_blocking(move || atomic_write_blocking(&write_path, &payload))
        .await
        .context("join channel pins write task")??;
    tracing::info!(
        action = "app_channel_pins_saved",
        path = %path.display()
    );
    Ok(())
}

/// 确保置顶文件存在（首次访问时写入默认空结构，便于用户手动编辑）。
pub async fn ensure_file_exists() -> Result<()> {
    if pins_file_path().exists() {
        return Ok(());
    }
    save_state(&ChannelPinsStateV1::default()).await
}

/// 设置指定服务器下某频道的置顶状态，返回写入后的完整状态。
pub async fn set_pinned(
    server_socket: &str,
    channel_id: &str,
    pinned: bool,
) -> Result<ChannelPinsStateV1> {
    let server = server_socket.trim();
    let channel = channel_id.trim();
    let mut state = load_state().unwrap_or_default();
    if server.is_empty() || channel.is_empty() {
        return Ok(state);
    }

    let should_remove = {
        let entry = state.servers.entry(server.to_string()).or_default();
        if pinned {
            if !entry.iter().any(|id| id == channel) {
                entry.push(channel.to_string());
            }
        } else {
            entry.retain(|id| id != channel);
        }
        entry.is_empty()
    };
    if should_remove {
        state.servers.remove(server);
    }

    save_state(&state).await?;
    tracing::info!(
        action = "app_channel_pins_updated",
        server = %server,
        channel_id = %channel,
        pinned = pinned
    );
    Ok(state)
}

/// 切换指定服务器下某频道的置顶状态。
pub async fn toggle_pinned(server_socket: &str, channel_id: &str) -> Result<ChannelPinsStateV1> {
    let state = load_state().unwrap_or_default();
    let currently_pinned = state
        .servers
        .get(server_socket.trim())
        .map(|ids| ids.iter().any(|id| id == channel_id.trim()))
        .unwrap_or(false);
    set_pinned(server_socket, channel_id, !currently_pinned).await
}

/// 文件指纹（修改时间纳秒 + 文件长度）。
fn fingerprint(path: &Path) -> Option<(u128, u64)> {
    let metadata = std::fs::metadata(path).ok()?;
    let modified = metadata.modified().ok()?;
    let nanos = modified
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    Some((nanos, metadata.len()))
}

/// 启动热加载监听：轮询文件变化并向前端广播最新状态。
pub fn start_watcher(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let path = pins_file_path();
        let mut last = fingerprint(&path);
        loop {
            tokio::time::sleep(WATCH_POLL_INTERVAL).await;
            let current = fingerprint(&path);
            if current == last {
                continue;
            }
            last = current;
            // 文件被删除或正处于写入中间态时不广播，保留前端最后一次已知状态。
            if current.is_none() {
                continue;
            }
            if let Some(state) = load_state() {
                if let Err(error) = app.emit(CHANNEL_PINS_CHANGED_EVENT, &state) {
                    tracing::warn!(action = "app_channel_pins_emit_failed", error = %error);
                } else {
                    tracing::info!(action = "app_channel_pins_hot_reloaded");
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::OnceLock;

    static TEST_LOCK: OnceLock<TokioMutex<()>> = OnceLock::new();

    async fn test_lock() -> tokio::sync::MutexGuard<'static, ()> {
        TEST_LOCK.get_or_init(|| TokioMutex::new(())).lock().await
    }

    fn use_temp_app_dir(name: &str) -> PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("carrypigeon-channel-pins-{name}-{stamp}"));
        let _ = crate::shared::app_data_dir::reset_app_data_dir();
        let _ = crate::shared::app_data_dir::init_app_data_dir(dir.clone());
        dir
    }

    #[tokio::test]
    async fn set_pinned_persists_and_toggles() {
        let _guard = test_lock().await;
        let dir = use_temp_app_dir("toggle");

        let state = set_pinned("socket://a", "c1", true).await.expect("pin");
        assert_eq!(
            state.servers.get("socket://a"),
            Some(&vec!["c1".to_string()])
        );
        assert!(pins_file_path().exists());

        let toggled = toggle_pinned("socket://a", "c1").await.expect("toggle");
        assert_eq!(toggled.servers.get("socket://a"), None);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn duplicate_pin_is_ignored() {
        let _guard = test_lock().await;
        let dir = use_temp_app_dir("duplicate");

        let _ = set_pinned("socket://a", "c1", true).await.expect("pin");
        let state = set_pinned("socket://a", "c1", true)
            .await
            .expect("pin again");
        assert_eq!(
            state.servers.get("socket://a"),
            Some(&vec!["c1".to_string()])
        );

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn load_state_returns_none_for_invalid_json() {
        let _guard = test_lock().await;
        let dir = use_temp_app_dir("invalid");
        std::fs::create_dir_all(&dir).expect("temp dir");
        std::fs::write(pins_file_path(), "{ not json").expect("write invalid");

        assert!(load_state().is_none());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn default_state_serializes_camel_case() {
        let json = serde_json::to_string(&ChannelPinsStateV1::default()).expect("serialize");
        assert!(json.contains("schemaVersion"));
        assert!(json.contains("servers"));
    }
}
