//! 主窗口位置/尺寸记忆模块。
//!
//! 在 Tauri `setup()` 阶段调用 `load()` 恢复上次的窗口 bounds，
//! 在 `on_window_event` 监听 `Resized`/`Moved` 时调用 `save_async()` 持久化。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::shared::app_data_dir;

/// 窗口位置和尺寸。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct WindowBounds {
    /// 窗口宽度（逻辑像素）。
    pub width: u32,
    /// 窗口高度（逻辑像素）。
    pub height: u32,
    /// 窗口左上角 X 坐标（逻辑像素）。
    pub x: i32,
    /// 窗口左上角 Y 坐标（逻辑像素）。
    pub y: i32,
}

/// 解析后的窗口 bounds 文件路径（位于 `app_data_dir/window-bounds.json`）。
fn bounds_file_path() -> Option<PathBuf> {
    app_data_dir::get_app_data_dir()
        .ok()
        .map(|dir| dir.join("window-bounds.json"))
}

/// 从磁盘读取上次的窗口 bounds。
///
/// 文件不存在或解析失败时返回 `None`。
pub fn load() -> Option<WindowBounds> {
    let path = bounds_file_path()?;
    let raw = std::fs::read_to_string(&path).ok()?;
    match serde_json::from_str::<WindowBounds>(&raw) {
        Ok(b) => {
            tracing::info!(
                action = "windows_bounds_loaded",
                path = %path.display(),
                width = b.width,
                height = b.height,
                x = b.x,
                y = b.y
            );
            Some(b)
        }
        Err(error) => {
            tracing::warn!(
                action = "windows_bounds_parse_failed",
                path = %path.display(),
                error = %error
            );
            None
        }
    }
}

/// 同步写窗口 bounds 到磁盘（直接写，失败仅记录日志）。
pub fn save(bounds: WindowBounds) {
    let Some(path) = bounds_file_path() else {
        tracing::warn!(action = "windows_bounds_save_no_data_dir");
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    match serde_json::to_string_pretty(&bounds) {
        Ok(raw) => {
            if let Err(error) = write_atomic(&path, raw.as_bytes()) {
                tracing::warn!(
                    action = "windows_bounds_save_failed",
                    path = %path.display(),
                    error = %error
                );
                return;
            }
            tracing::debug!(
                action = "windows_bounds_saved",
                path = %path.display(),
                width = bounds.width,
                height = bounds.height,
                x = bounds.x,
                y = bounds.y
            );
        }
        Err(error) => {
            tracing::warn!(
                action = "windows_bounds_serialize_failed",
                error = %error
            );
        }
    }
}

/// 异步写窗口 bounds（推荐在 on_window_event 中调用，避免阻塞主循环）。
pub fn save_async(bounds: WindowBounds) {
    let Some(path) = bounds_file_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let raw = match serde_json::to_string(&bounds) {
        Ok(s) => s,
        Err(error) => {
            tracing::warn!(action = "windows_bounds_serialize_failed", error = %error);
            return;
        }
    };
    tauri::async_runtime::spawn(async move {
        if let Err(error) = tokio::fs::write(&path, raw.as_bytes()).await {
            tracing::warn!(
                action = "windows_bounds_save_failed",
                path = %path.display(),
                error = %error
            );
        } else {
            tracing::debug!(
                action = "windows_bounds_saved_async",
                path = %path.display()
            );
        }
    });
}

/// 原子写：先写临时文件再 rename，避免半写入状态。
fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp = parent.join(format!(
        ".window-bounds.tmp-{}-{}",
        std::process::id(),
        stamp
    ));
    {
        let mut file = std::fs::File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    if let Err(error) = std::fs::rename(&tmp, path) {
        // Windows 上 rename 到已存在文件会失败，回退覆盖
        if path.exists() {
            std::fs::remove_file(path)?;
            std::fs::rename(&tmp, path)?;
        } else {
            let _ = std::fs::remove_file(&tmp);
            return Err(error);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_serialize() {
        let b = WindowBounds {
            width: 1280,
            height: 800,
            x: 100,
            y: 50,
        };
        let s = serde_json::to_string(&b).unwrap();
        let p: WindowBounds = serde_json::from_str(&s).unwrap();
        assert_eq!(p, b);
    }
}
