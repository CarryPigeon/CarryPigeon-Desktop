//! plugin_store｜插件密钥保管箱（系统 keyring，按 server_id + plugin_id 隔离）。
//!
//! 说明：
//! - 插件需要安全存放 API Key 等敏感凭据，不允许把明文写进 storage.json（KV 存储）；
//! - 这里把密钥写入系统 keyring（Windows 凭据管理器 / macOS Keychain / Secret Service），
//!   账户名按 `plugin-secret:{server_id}:{plugin_id}:{secret_name}` 三段独立净化后拼接，
//!   命名空间与 KV 存储一致（按 server + plugin 隔离，跨 server 不可互读）；
//! - 状态查询只返回"是否已配置"，永不把密钥明文回传给前端。
//!
//! 约定：注释中文，日志英文（tracing）；**任何日志都不得包含密钥内容**。

use crate::features::plugins::domain::types::PluginSecretStatus;
use crate::shared::secure_store;

use super::{api::fetch_server_id, origin::to_http_origin};

/// keyring 账户名前缀（与其它模块的条目隔离）。
const ACCOUNT_PREFIX: &str = "plugin-secret";

/// 由三段标识构造 keyring 账户名（每段独立净化，拒绝越界字符防止串号）。
///
/// # 参数
/// - `server_id`：服务端 id。
/// - `plugin_id`：插件 id。
/// - `secret_name`：密钥名（插件自定义，如 `api_key`）。
///
/// # 返回值
/// - 净化拼接后的账户名；任一段非法时返回错误。
pub(super) fn account_for(
    server_id: &str,
    plugin_id: &str,
    secret_name: &str,
) -> anyhow::Result<String> {
    Ok(format!(
        "{ACCOUNT_PREFIX}:{}:{}:{}",
        secure_store::sanitize_account_component(server_id)?,
        secure_store::sanitize_account_component(plugin_id)?,
        secure_store::sanitize_account_component(secret_name)?,
    ))
}

/// 写入（覆盖）插件密钥。
///
/// # 参数
/// - `server_socket`：服务端 socket（用于解析 origin 并获取 server_id）。
/// - `plugin_id`：插件 id。
/// - `name`：密钥名。
/// - `value`：密钥明文（仅经 IPC 传入，写入系统 keyring，不落库、不进日志）。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
pub async fn secret_set(
    server_socket: &str,
    plugin_id: &str,
    name: &str,
    value: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<()> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(anyhow::anyhow!("Secret value is empty"));
    }
    let (server_id, account) =
        resolve_account(server_socket, plugin_id, name, tls_policy, tls_fingerprint).await?;
    tracing::debug!(action = "plugins_secret_set", server_id = %server_id, plugin_id = %plugin_id, name = %name);
    secure_store::set_secret(&account, trimmed)
}

/// 查询插件密钥状态（不返回密钥内容）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
/// - `plugin_id`：插件 id。
/// - `name`：密钥名。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(PluginSecretStatus)`：`{ configured, secureStorageAvailable }`。
pub async fn secret_status(
    server_socket: &str,
    plugin_id: &str,
    name: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<PluginSecretStatus> {
    let (_server_id, account) =
        resolve_account(server_socket, plugin_id, name, tls_policy, tls_fingerprint).await?;
    match secure_store::get_secret(&account) {
        Ok(secret) => Ok(PluginSecretStatus {
            configured: secret
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false),
            secure_storage_available: true,
        }),
        Err(err) => {
            let message = format!("{err}");
            if secure_store::is_secure_storage_unavailable_error(&message) {
                // 安全存储不可用（如 Linux 无 Secret Service）：按"未配置 + 不可用"返回，
                // 让插件可以给出可操作的提示，而不是把 IPC 异常抛进运行时。
                tracing::warn!(action = "plugins_secret_status_unavailable", plugin_id = %plugin_id, error = %message);
                return Ok(PluginSecretStatus {
                    configured: false,
                    secure_storage_available: false,
                });
            }
            Err(err)
        }
    }
}

/// 清除插件密钥（幂等：未配置时同样返回成功）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
/// - `plugin_id`：插件 id。
/// - `name`：密钥名。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
pub async fn secret_clear(
    server_socket: &str,
    plugin_id: &str,
    name: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<()> {
    let (server_id, account) =
        resolve_account(server_socket, plugin_id, name, tls_policy, tls_fingerprint).await?;
    tracing::debug!(action = "plugins_secret_clear", server_id = %server_id, plugin_id = %plugin_id, name = %name);
    secure_store::delete_secret(&account)
}

/// 解析 server_id 并构造 keyring 账户名（净化在 account_for 内完成）。
async fn resolve_account(
    server_socket: &str,
    plugin_id: &str,
    name: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<(String, String)> {
    let origin = to_http_origin(server_socket)?;
    let server_id = fetch_server_id(&origin, tls_policy, tls_fingerprint).await?;
    let account = account_for(&server_id, plugin_id, name)?;
    Ok((server_id, account))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_name_is_normalized_and_prefixed() {
        let account = account_for(" ServerA ", "Ai-Summary", "API_KEY").unwrap();
        assert_eq!(account, "plugin-secret:servera:ai-summary:api_key");
    }

    #[test]
    fn account_name_rejects_unsafe_components() {
        assert!(account_for("a/b", "p", "k").is_err());
        assert!(account_for("s", "p", "").is_err());
        assert!(account_for("s", "p", &"k".repeat(65)).is_err());
        assert!(account_for("", "p", "k").is_err());
    }

    #[test]
    fn account_components_are_isolated_per_namespace() {
        // 三段命名空间任一不同即落位不同账户，防止跨 server/plugin 串号。
        let a = account_for("srv1", "plugin", "key").unwrap();
        let b = account_for("srv2", "plugin", "key").unwrap();
        let c = account_for("srv1", "other", "key").unwrap();
        assert_ne!(a, b);
        assert_ne!(a, c);
    }
}
