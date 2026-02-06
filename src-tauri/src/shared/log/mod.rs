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

#[tauri::command]
/// 记录一条 INFO 级别日志。
///
/// # 参数
/// - `message`: 日志消息（建议为英文）。
pub fn log_info(message: String) {
    info!("{}", message);
}

#[tauri::command]
/// 记录一条 ERROR 级别日志。
///
/// # 参数
/// - `message`: 日志消息（建议为英文）。
pub fn log_error(message: String) {
    error!("{}", message);
}

#[tauri::command]
/// 记录一条 WARN 级别日志。
///
/// # 参数
/// - `message`: 日志消息（建议为英文）。
pub fn log_warning(message: String) {
    warn!("{}", message);
}

#[tauri::command]
/// 记录一条 DEBUG 级别日志。
///
/// # 参数
/// - `message`: 日志消息（建议为英文）。
pub fn log_debug(message: String) {
    debug!("{}", message);
}
