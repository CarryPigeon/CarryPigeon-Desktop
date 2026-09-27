//! shared｜安全存储：系统 keyring 密钥读写统一封装。
//!
//! 说明：
//! - `chat_cache` 因历史原因保留了一份私有实现（不修改），新模块统一走本文件；
//! - 集中处理各平台/后端对“条目不存在”与“存储不可用”的措辞差异。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::sync::Once;

use anyhow::Result;
use keyring_core::Entry;

/// keyring 服务名（与 chat_cache 使用同一命名空间）。
pub const KEYRING_SERVICE: &str = "carrypigeon-desktop";

/// “安全存储不可用”错误消息前缀（跨层识别用，不泄露底层平台细节）。
pub const SECURE_STORAGE_UNAVAILABLE_MARKER: &str = "secure storage is unavailable";

/// 账户名（account component）过滤后的最大长度。
const MAX_ACCOUNT_COMPONENT_LEN: usize = 64;

/// keyring 默认存储初始化开关（进程级幂等）。
static ENSURE_KEYRING_STORE: Once = Once::new();

/// 幂等初始化 keyring 默认凭证存储。
///
/// 说明：
/// - `keyring-core` 要求先设置默认存储，否则 `Entry::new` 会返回 NoDefaultStore；
/// - 测试环境通常没有会话总线/平台凭证存储，这里直接跳过真实初始化，
///   Entry 相关失败路径按“未配置”处理（单元测试不依赖真实 keyring）。
pub fn ensure_default_keyring_store() {
    if cfg!(test) {
        return;
    }
    ENSURE_KEYRING_STORE.call_once(|| {
        // keyring 4.2（v1 模式）：首次访问自动初始化平台默认存储，
        // Linux 上为 Secret Service（跨重启持久化），跳过会话级 keyutils。
        if let Err(err) = keyring::Entry::store_status() {
            tracing::warn!(action = "app_secure_store_keyring_init_failed", error = %err);
        }
    });
}

/// 判断错误消息是否表示“条目不存在”（多平台/多后端方言）。
///
/// 与 `chat_cache::is_missing_secure_storage_error_message` 保持同一套匹配规则。
pub fn is_missing_entry_error(message: &str) -> bool {
    message.contains("not found")
        || message.contains("NoEntry")
        || message.contains("No matching entry found in secure storage")
        // dbus-secret-service（libdbus 同步变体）的“条目不存在”措辞。
        || message.contains("No matching credential")
        || message.contains("No default store has been set")
        || message.contains("cannot search or create entries")
}

/// 判断错误消息是否表示“安全存储不可用”（而非“条目不存在”）。
///
/// 说明：keyring 的 NoDefaultStore 同时包含“No default store has been set”与
/// “cannot search or create entries”，两句话出现在同一条消息里；调用方需要区分
/// “存储不可用”与“条目不存在”时，必须先判断本函数。
pub fn is_secure_storage_unavailable_error(message: &str) -> bool {
    message.contains(SECURE_STORAGE_UNAVAILABLE_MARKER)
        || message.contains("No default store has been set")
        || message.contains("cannot search or create entries")
        || message.contains("Platform secure storage failure")
        || message.contains("Couldn't access platform storage")
}

/// 净化账户名组件（安全边界）。
///
/// 调用方会把用户/配置可影响的 provider id 拼接进 keyring 账户名，因此这里做白名单校验：
/// - 去除首尾空白并统一小写；
/// - 只允许 `[a-z0-9._-]`，出现其它字符直接拒绝（不静默剔除：静默剔除会让 `a/b`
///   与 `ab` 落到同一账户，造成密钥串号或越权读取）；
/// - 过滤后为空、或长度超过 64 字符时拒绝。
pub fn sanitize_account_component(raw: &str) -> Result<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(anyhow::anyhow!("account component is empty"));
    }

    let mut sanitized = String::with_capacity(trimmed.len());
    for ch in trimmed.chars() {
        let lowered = ch.to_ascii_lowercase();
        let allowed = lowered.is_ascii_lowercase()
            || lowered.is_ascii_digit()
            || matches!(lowered, '.' | '_' | '-');
        if !allowed {
            return Err(anyhow::anyhow!(
                "account component contains unsupported characters"
            ));
        }
        sanitized.push(lowered);
    }

    if sanitized.is_empty() {
        return Err(anyhow::anyhow!("account component is empty"));
    }
    if sanitized.chars().count() > MAX_ACCOUNT_COMPONENT_LEN {
        return Err(anyhow::anyhow!(
            "account component is longer than {MAX_ACCOUNT_COMPONENT_LEN} characters"
        ));
    }
    Ok(sanitized)
}

/// 读取密钥：条目不存在时返回 `Ok(None)`，其余失败返回 `Err`。
pub fn get_secret(account: &str) -> Result<Option<String>> {
    ensure_default_keyring_store();
    let entry = match Entry::new(KEYRING_SERVICE, account) {
        Ok(entry) => entry,
        Err(err) => return resolve_lookup_error(err),
    };
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(err) => resolve_lookup_error(err),
    }
}

/// 写入密钥（存在则覆盖）。
pub fn set_secret(account: &str, secret: &str) -> Result<()> {
    ensure_default_keyring_store();
    let entry = Entry::new(KEYRING_SERVICE, account).map_err(resolve_write_error)?;
    entry.set_password(secret).map_err(resolve_write_error)
}

/// 删除密钥：条目不存在视为成功（幂等）。
pub fn delete_secret(account: &str) -> Result<()> {
    ensure_default_keyring_store();
    let entry = match Entry::new(KEYRING_SERVICE, account) {
        Ok(entry) => entry,
        Err(err) => return resolve_delete_error(err),
    };
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(err) => resolve_delete_error(err),
    }
}

/// 读取路径的错误归一化：先区分“存储不可用”，再区分“条目不存在”。
fn resolve_lookup_error(err: keyring_core::Error) -> Result<Option<String>> {
    let message = err.to_string();
    if is_secure_storage_unavailable_error(&message) {
        return Err(anyhow::anyhow!(
            "{SECURE_STORAGE_UNAVAILABLE_MARKER}: {message}"
        ));
    }
    if is_missing_entry_error(&message) {
        return Ok(None);
    }
    Err(anyhow::anyhow!(
        "Failed to read secure storage entry: {message}"
    ))
}

/// 写入路径的错误归一化。
fn resolve_write_error(err: keyring_core::Error) -> anyhow::Error {
    let message = err.to_string();
    if is_secure_storage_unavailable_error(&message) {
        return anyhow::anyhow!("{SECURE_STORAGE_UNAVAILABLE_MARKER}: {message}");
    }
    anyhow::anyhow!("Failed to write secure storage entry: {message}")
}

/// 删除路径的错误归一化：条目不存在视为成功。
fn resolve_delete_error(err: keyring_core::Error) -> Result<()> {
    let message = err.to_string();
    if is_secure_storage_unavailable_error(&message) {
        return Err(anyhow::anyhow!(
            "{SECURE_STORAGE_UNAVAILABLE_MARKER}: {message}"
        ));
    }
    if is_missing_entry_error(&message) {
        return Ok(());
    }
    Err(anyhow::anyhow!(
        "Failed to delete secure storage entry: {message}"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_lowercases_and_trims() {
        assert_eq!(
            sanitize_account_component("  OpenAI.GPT-4_Mini  ").unwrap(),
            "openai.gpt-4_mini"
        );
        assert_eq!(sanitize_account_component("ollama").unwrap(), "ollama");
    }

    #[test]
    fn sanitize_rejects_unexpected_characters() {
        // 拒绝而不是静默剔除：避免不同 provider id 折叠到同一账户名。
        for raw in ["a/b", "a b", "a:b", "openai\u{4e2d}", "a\nb", "sk-*"] {
            assert!(
                sanitize_account_component(raw).is_err(),
                "expected rejection for {raw:?}"
            );
        }
    }

    #[test]
    fn sanitize_rejects_empty_and_too_long() {
        assert!(sanitize_account_component("").is_err());
        assert!(sanitize_account_component("   ").is_err());
        assert!(sanitize_account_component(&"a".repeat(64)).is_ok());
        assert!(sanitize_account_component(&"a".repeat(65)).is_err());
    }

    #[test]
    fn detects_missing_entry_dialects() {
        assert!(is_missing_entry_error("No matching credential found"));
        assert!(is_missing_entry_error("entry not found"));
        assert!(is_missing_entry_error("NoEntry"));
        assert!(is_missing_entry_error(
            "No default store has been set, so cannot search or create entries"
        ));
        assert!(!is_missing_entry_error("Permission denied"));
    }

    #[test]
    fn unavailable_is_distinguished_from_missing() {
        assert!(is_secure_storage_unavailable_error(
            "No default store has been set, so cannot search or create entries"
        ));
        assert!(is_secure_storage_unavailable_error(
            "secure storage is unavailable: platform failure"
        ));
        assert!(!is_secure_storage_unavailable_error(
            "No matching credential found"
        ));
        // 存储不可用同样命中 “missing” 匹配器，因此判定顺序必须先行。
        let message = "No default store has been set, so cannot search or create entries";
        assert!(is_missing_entry_error(message) && is_secure_storage_unavailable_error(message));
    }
}
