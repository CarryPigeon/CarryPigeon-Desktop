//! windows｜DI/命令入口：info_window。
//!
//! 约定：注释中文，日志英文（tracing）。
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// 打开信息窗口（用户资料/频道信息等）。
///
/// 设计目标：
/// - 独立窗口，允许编辑/长时间停留
/// - 同 label 只保留一个实例（避免重复打开）
pub async fn open_info_window_impl(
    app: AppHandle,
    label: String,
    title: String,
    query: String,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let safe_label = if label.trim().is_empty() {
        "info-window".to_string()
    } else {
        label
    };

    if let Some(existing) = app.get_webview_window(&safe_label) {
        let _ = existing.close();
    }

    let url = WebviewUrl::App(format!("index.html?{}", query).into());

    let min_width = 360.0;
    let min_height = 240.0;

    let window = WebviewWindowBuilder::new(&app, safe_label, url)
        .title(title)
        .resizable(true)
        .decorations(true)
        .center()
        .inner_size(width.max(min_width), height.max(min_height))
        .build()
        .map_err(|e| e.to_string())?;

    let _ = window.set_focus();

    Ok(())
}
