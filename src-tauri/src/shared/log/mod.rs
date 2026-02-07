//! 原生侧日志桥接（WebView → Rust）。
//!
//! 用途：
//! - 前端（WebView）通过 `invoke` 将日志写入原生日志系统（tracing）。
//! - 便于在桌面端统一收集与排查问题（尤其是用户侧无法打开 DevTools 的场景）。
//!
//! 约定：
//! - 注释统一使用中文，便于团队维护与交接。
//! - 日志输出统一使用英文，便于跨端检索与与上游/第三方日志对齐。

use tracing::{debug, error, info, warn};

use crate::shared::error::CommandResult;

/// 从 WebView 传入消息中提取 `action` 字段。
///
/// # 参数
/// - `message`: 前端传入日志消息（建议 `Action: <snake_case>` 开头）。
///
/// # 返回值
/// 提取出的 action；未提取到时返回 `webview_log`。
fn extract_action(message: &str) -> String {
    let trimmed = message.trim();
    let candidate = if let Some(rest) = trimmed.strip_prefix("Action:") {
        rest.trim_start()
    } else if let Some(rest) = trimmed.strip_prefix("action:") {
        rest.trim_start()
    } else {
        return "webview_log".to_string();
    };

    let mut action = String::new();
    for ch in candidate.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' {
            action.push(ch.to_ascii_lowercase());
            continue;
        }
        break;
    }

    if action.is_empty() {
        "webview_log".to_string()
    } else {
        action
    }
}

#[tauri::command]
/// 记录一条 INFO 级别日志。
///
/// # 参数
/// - `message`: 日志消息（建议为 `Action: <snake_case>`）。
pub fn log_info(message: String) -> CommandResult<()> {
    let action = extract_action(&message);
    info!(action = %action, level = "info", source = "webview", message = %message);
    Ok(())
}

#[tauri::command]
/// 记录一条 ERROR 级别日志。
///
/// # 参数
/// - `message`: 日志消息（建议为 `Action: <snake_case>`）。
pub fn log_error(message: String) -> CommandResult<()> {
    let action = extract_action(&message);
    error!(action = %action, level = "error", source = "webview", message = %message);
    Ok(())
}

#[tauri::command]
/// 记录一条 WARN 级别日志。
///
/// # 参数
/// - `message`: 日志消息（建议为 `Action: <snake_case>`）。
pub fn log_warning(message: String) -> CommandResult<()> {
    let action = extract_action(&message);
    warn!(action = %action, level = "warn", source = "webview", message = %message);
    Ok(())
}

#[tauri::command]
/// 记录一条 DEBUG 级别日志。
///
/// # 参数
/// - `message`: 日志消息（建议为 `Action: <snake_case>`）。
pub fn log_debug(message: String) -> CommandResult<()> {
    let action = extract_action(&message);
    debug!(action = %action, level = "debug", source = "webview", message = %message);
    Ok(())
}
