//! ai｜数据层：keyring 密钥存储适配器。
//!
//! 约定：注释中文，日志英文（tracing）；**任何日志都不得包含密钥内容**。

use std::sync::Arc;

use crate::features::ai::domain::ports::AiSecretStorePort;
use crate::shared::secure_store;

/// keyring 账户名前缀（与其它模块的条目隔离）。
const ACCOUNT_PREFIX: &str = "ai-provider-api-key";

/// 基于系统 keyring 的 AI 密钥存储适配器（无状态，可共享）。
#[derive(Debug, Default)]
pub struct KeyringAiSecretStore;

impl KeyringAiSecretStore {
    /// 构造共享实例（无状态，便于 DI 注入）。
    pub fn shared() -> Arc<Self> {
        Arc::new(Self)
    }

    /// 由 provider id 构造 keyring 账户名。
    ///
    /// provider id 来自前端（用户可影响），拼接前必须经白名单净化，
    /// 防止越界字符或超长账户名进入 Windows 凭据管理器 / Secret Service。
    fn account_for(provider_id: &str) -> anyhow::Result<String> {
        Ok(format!(
            "{ACCOUNT_PREFIX}:{}",
            secure_store::sanitize_account_component(provider_id)?
        ))
    }
}

impl AiSecretStorePort for KeyringAiSecretStore {
    fn get_secret(&self, provider_id: &str) -> anyhow::Result<Option<String>> {
        let account = Self::account_for(provider_id)?;
        secure_store::get_secret(&account)
    }

    fn set_secret(&self, provider_id: &str, secret: &str) -> anyhow::Result<()> {
        let account = Self::account_for(provider_id)?;
        secure_store::set_secret(&account, secret)
    }

    fn delete_secret(&self, provider_id: &str) -> anyhow::Result<()> {
        let account = Self::account_for(provider_id)?;
        secure_store::delete_secret(&account)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_name_is_normalized_and_prefixed() {
        let account = KeyringAiSecretStore::account_for("  OpenAI  ").unwrap();
        assert_eq!(account, "ai-provider-api-key:openai");
    }

    #[test]
    fn account_name_rejects_unsafe_provider_ids() {
        assert!(KeyringAiSecretStore::account_for("").is_err());
        assert!(KeyringAiSecretStore::account_for("a/b").is_err());
        assert!(KeyringAiSecretStore::account_for(&"a".repeat(65)).is_err());
    }
}
