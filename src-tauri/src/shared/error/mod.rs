//! shared｜错误模型：tauri command 统一错误标准。
//!
//! 约定：
//! - 对前端暴露的 Tauri command 返回统一使用 `CommandResult<T>`；
//! - 错误消息统一采用 `[ERROR_CODE] message` 结构，便于前端解析与日志检索；
//! - 记录错误日志时统一使用 `action = "tauri_command_failed"`。

use std::fmt::Display;

/// Tauri command 统一返回类型。
///
/// # 说明
/// - 目前保持与前端兼容：错误仍为字符串；
/// - 字符串格式统一为 `[ERROR_CODE] message`。
pub type CommandResult<T> = Result<T, String>;

/// 构建统一格式的命令错误消息。
///
/// # 参数
/// - `code`：稳定错误码（建议大写下划线风格）。
/// - `message`：错误消息。
///
/// # 返回值
/// 统一格式字符串：`[ERROR_CODE] message`。
pub fn command_error(code: &'static str, message: impl Into<String>) -> String {
    format!("[{code}] {}", message.into())
}

/// 将任意可显示错误转换为统一命令错误，并输出结构化日志。
///
/// # 参数
/// - `code`：稳定错误码。
/// - `error`：原始错误对象。
///
/// # 返回值
/// 统一格式字符串：`[ERROR_CODE] message`。
pub fn to_command_error<E>(code: &'static str, error: E) -> String
where
    E: Display,
{
    let message = error.to_string();
    tracing::error!(action = "tauri_command_failed", code, error = %message);
    command_error(code, message)
}
