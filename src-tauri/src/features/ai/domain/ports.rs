//! ai｜领域端口：手动装箱 Future 的异步端口（不使用 `async_trait` 宏）。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::future::Future;
use std::pin::Pin;

use crate::features::ai::domain::model::{AiChatOutcome, AiChatRequest, AiModelsRequest};

/// AI 聊天补全端口 Future 类型。
pub type AiChatFuture<'a> =
    Pin<Box<dyn Future<Output = anyhow::Result<AiChatOutcome>> + Send + 'a>>;

/// AI 聊天补全端口（由数据层适配器实现）。
pub trait AiChatPort: Send + Sync {
    /// 执行一次 OpenAI 兼容聊天补全请求。
    fn chat_completion<'a>(&'a self, request: AiChatRequest) -> AiChatFuture<'a>;
}

/// AI 模型列表端口 Future 类型。
pub type AiModelsFuture<'a> =
    Pin<Box<dyn Future<Output = anyhow::Result<Vec<String>>> + Send + 'a>>;

/// AI 模型列表端口（由数据层适配器实现）。
pub trait AiModelsPort: Send + Sync {
    /// 拉取 OpenAI 兼容模型列表。
    fn list_models<'a>(&'a self, request: AiModelsRequest) -> AiModelsFuture<'a>;
}

/// AI 密钥存储端口（由数据层适配器实现，底层为系统 keyring）。
pub trait AiSecretStorePort: Send + Sync {
    /// 读取密钥：未配置返回 `Ok(None)`。
    fn get_secret(&self, provider_id: &str) -> anyhow::Result<Option<String>>;
    /// 写入（覆盖）密钥。
    fn set_secret(&self, provider_id: &str, secret: &str) -> anyhow::Result<()>;
    /// 删除密钥（幂等）。
    fn delete_secret(&self, provider_id: &str) -> anyhow::Result<()>;
}
