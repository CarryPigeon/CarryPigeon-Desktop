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

/// 构建统一格式的命令错误消息（i18n版本）。
///
/// # 参数
/// - `code`：稳定错误码（建议大写下划线风格）。
/// - `i18n_key`：翻译key，格式为 `error.{code_lowercase}`。
///
/// # 返回值
/// 统一格式字符串：`[ERROR_CODE] 翻译后的消息`。
pub fn command_error(code: &'static str, i18n_key: &str) -> String {
    let message = rust_i18n::t!(i18n_key);
    format!("[{code}] {message}")
}

/// 将任意可显示错误转换为统一命令错误，并输出结构化日志（i18n版本）。
///
/// # 参数
/// - `code`：稳定错误码。
/// - `i18n_key`：翻译key，格式为 `error.{code_lowercase}`。
/// - `error`：原始错误对象（仅用于日志记录）。
///
/// # 返回值
/// 统一格式字符串：`[ERROR_CODE] 翻译后的消息`。
pub fn to_command_error<E>(code: &'static str, i18n_key: &str, error: E) -> String
where
    E: Display,
{
    let raw_message = error.to_string();
    tracing::error!(action = "tauri_command_failed", code, error = %raw_message);
    command_error(code, i18n_key)
}
