//! windows｜DI/命令入口：info_window。
//!
//! 约定：注释中文，日志英文（tracing）。
use anyhow::anyhow;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// 允许前端动态创建的信息窗口 label。
///
/// 拒绝 `main` / 截图遮罩 / popover 等保留窗口，避免前端借任意 label 覆盖特权窗口。
fn normalize_info_window_label(label: &str) -> anyhow::Result<String> {
    let candidate = label.trim();
    let candidate = if candidate.is_empty() {
        "info-window"
    } else {
        candidate
    };
    const ALLOWED: &[&str] = &["info-window", "user-info", "channel-info", "about-window"];
    const RESERVED: &[&str] = &[
        "main",
        "screenshot-overlay",
        "user-info-popover",
        "popover",
        "channel-info-popover",
    ];
    if RESERVED.contains(&candidate) {
        return Err(anyhow!("window label is reserved: {candidate}"));
    }
    let charset_ok = candidate.len() <= 48
        && candidate
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    let allowed = ALLOWED.contains(&candidate) || candidate.starts_with("info-");
    if charset_ok && allowed {
        return Ok(candidate.to_string());
    }
    Err(anyhow!("window label is not allowed: {candidate}"))
}

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
) -> anyhow::Result<()> {
    let safe_label = normalize_info_window_label(&label)?;

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
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    let _ = window.set_focus();

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::normalize_info_window_label;

    #[test]
    fn empty_label_defaults_to_info_window() {
        assert_eq!(normalize_info_window_label("").unwrap(), "info-window");
    }

    #[test]
    fn allows_known_and_prefixed_labels() {
        assert_eq!(normalize_info_window_label("user-info").unwrap(), "user-info");
        assert_eq!(
            normalize_info_window_label("info-help").unwrap(),
            "info-help"
        );
    }

    #[test]
    fn rejects_reserved_and_arbitrary_labels() {
        assert!(normalize_info_window_label("main").is_err());
        assert!(normalize_info_window_label("screenshot-overlay").is_err());
        assert!(normalize_info_window_label("evil Window").is_err());
        assert!(normalize_info_window_label("../etc").is_err());
    }
}
