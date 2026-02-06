//! windows｜用例层：window_usecases。
//!
//! 约定：注释中文，日志英文（tracing）。
use tauri::{AppHandle, Manager};

/// 确保同一时刻只保留一个 Popover 窗口。
///
/// # 参数
/// - `app`：Tauri 应用句柄，用于查找并关闭已存在的 popover 窗口。
///
/// # 返回值
/// 无返回值。
///
/// # 说明
/// - Popover 窗口在不同场景下可能使用不同的 label（例如 `user-info-popover`/`popover`/`channel-info-popover`）。
/// - 若存在任意一个，则尝试关闭；关闭失败会被忽略（best-effort）。
pub fn keep_one_popover_window(app: &AppHandle) {
    if let Some(existing) = app
        .get_webview_window("user-info-popover")
        .or(app.get_webview_window("popover"))
        .or(app.get_webview_window("channel-info-popover"))
    {
        let _ = existing.close();
    }
}
