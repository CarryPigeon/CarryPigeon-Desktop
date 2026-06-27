//! 原生侧日志桥接（WebView → Rust）。
//!
//! 用途：
//! - 前端（WebView）通过 `invoke` 将日志写入原生日志系统（tracing）。
//! - 便于在桌面端统一收集与排查问题（尤其是用户侧无法打开 DevTools 的场景）。
//!
//! 约定：
//! - 注释统一使用中文，便于团队维护与交接。
//! - 日志输出统一使用英文，便于跨端检索与与上游/第三方日志对齐。

use std::sync::OnceLock;

use tracing::{debug, error, info, warn};

use crate::shared::error::CommandResult;
use regex::{Captures, Regex};

/// 从 WebView 传入消息中提取 `action` 字段。
///
/// # 参数
/// - `message`: 前端传入日志消息（建议 `Action: <snake_case>` 开头）。
///
/// # 返回值
/// 提取出的 action；未提取到时返回 `webview_log`。
fn extract_action(message: &str) -> String {
    let Some((action, _)) = split_action_and_body(message) else {
        return "webview_log".to_string();
    };

    action
}

fn split_action_and_body(message: &str) -> Option<(String, &str)> {
    let trimmed = message.trim();
    let candidate = if let Some(rest) = trimmed.strip_prefix("Action:") {
        rest.trim_start()
    } else if let Some(rest) = trimmed.strip_prefix("action:") {
        rest.trim_start()
    } else {
        return None;
    };

    let mut action = String::new();
    let mut body_start = candidate.len();
    for (index, ch) in candidate.char_indices() {
        if ch.is_ascii_alphanumeric() || ch == '_' {
            action.push(ch.to_ascii_lowercase());
            body_start = index + ch.len_utf8();
            continue;
        }
        break;
    }

    if action.is_empty() {
        None
    } else {
        Some((action, candidate[body_start..].trim_start()))
    }
}

struct LogRedactRules {
    bearer: Regex,
    kv: [Regex; 7],
}

fn redact_rules() -> Option<&'static LogRedactRules> {
    static RULES: OnceLock<Option<LogRedactRules>> = OnceLock::new();
    RULES
        .get_or_init(|| {
            let bearer = Regex::new(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+").ok()?;
            let kv: [Regex; 7] = [
                Regex::new(r#"(?i)(["']?token["']?\s*[:=]\s*["'])[^"']*(["'])"#).ok()?,
                Regex::new(r#"(?i)(["']?authorization["']?\s*[:=]\s*["'])[^"']*(["'])"#).ok()?,
                Regex::new(r#"(?i)(["']?password["']?\s*[:=]\s*["'])[^"']*(["'])"#).ok()?,
                Regex::new(r#"(?i)(["']?secret["']?\s*[:=]\s*["'])[^"']*(["'])"#).ok()?,
                Regex::new(r#"(?i)(["']?key["']?\s*[:=]\s*["'])[^"']*(["'])"#).ok()?,
                Regex::new(r#"(?i)(["']?code["']?\s*[:=]\s*["'])[^"']*(["'])"#).ok()?,
                Regex::new(r#"(?i)(["']?verification["']?\s*[:=]\s*["'])[^"']*(["'])"#).ok()?,
            ];
            Some(LogRedactRules { bearer, kv })
        })
        .as_ref()
}

fn redact_sensitive_message_body(body: &str) -> String {
    let Some(rules) = redact_rules() else {
        return body.to_string();
    };

    let mut sanitized = rules.bearer.replace_all(body, "[REDACTED]").into_owned();

    for re in &rules.kv {
        sanitized = re
            .replace_all(&sanitized, |caps: &Captures<'_>| {
                format!("{}[REDACTED]{}", &caps[1], &caps[2])
            })
            .into_owned();
    }

    sanitized
}

fn redact_log_message(message: &str) -> String {
    let Some((action, body)) = split_action_and_body(message) else {
        return redact_sensitive_message_body(message);
    };

    if body.is_empty() {
        format!("Action: {action}")
    } else {
        format!("Action: {action} {}", redact_sensitive_message_body(body))
    }
}

#[tauri::command]
/// 记录一条 INFO 级别日志。
///
/// # 参数
/// - `message`: 日志消息（建议为 `Action: <snake_case>`）。
pub fn log_info(message: String) -> CommandResult<()> {
    let action = extract_action(&message);
    let message = redact_log_message(&message);
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
    let message = redact_log_message(&message);
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
    let message = redact_log_message(&message);
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
    let message = redact_log_message(&message);
    debug!(action = %action, level = "debug", source = "webview", message = %message);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{extract_action, redact_log_message};

    #[test]
    fn log_action_preserved() {
        assert_eq!(
            extract_action("Action: network_tcp_send_failed {\"error\":\"boom\"}"),
            "network_tcp_send_failed"
        );
        assert_eq!(
            extract_action("action: app_session_auth_session_clear_failed"),
            "app_session_auth_session_clear_failed"
        );
    }

    #[test]
    fn log_redacts_sensitive_values() {
        let message = r#"Action: network_login_failed {"authorization":"Bearer abc.def.ghi","password":"p@ssw0rd","verification_code":"123456","token":"secret-token","note":"Bearer zyx"}"#;

        let redacted = redact_log_message(message);

        assert_eq!(
            redacted,
            r#"Action: network_login_failed {"authorization":"[REDACTED]","password":"[REDACTED]","verification_code":"[REDACTED]","token":"[REDACTED]","note":"[REDACTED]"}"#
        );
        assert!(!redacted.contains("abc.def.ghi"));
        assert!(!redacted.contains("p@ssw0rd"));
        assert!(!redacted.contains("123456"));
    }
}
