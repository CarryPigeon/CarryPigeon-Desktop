//! ai｜DI 边界模型：前端契约 DTO。
//!
//! 说明：
//! - 入参以平铺命令参数暴露（Tauri 默认把 Rust snake_case 参数映射为前端 camelCase 键），
//!   即 `invoke("ai_chat_completion", { providerId, baseUrl, ... })` 的平铺形状；
//! - 出参统一用 camelCase DTO，可选字段缺省时序列化为 `null`，与前端类型契约一致。
//!
//! 约定：注释中文，日志英文（tracing）。

/// AI 聊天消息（前端 -> Rust）。
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatMessageArgs {
    /// 角色（`system` / `user` / `assistant`）。
    pub role: String,
    /// 文本内容。
    pub content: String,
}

/// AI 聊天补全结果（Rust -> 前端）。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatCompletionResult {
    /// 是否成功（前端据此分支，不依赖 IPC 报错）。
    pub ok: bool,
    /// HTTP 状态码（本地前置失败为 0）。
    pub status: u16,
    /// 助手回复文本。
    pub content: String,
    /// 上游返回的模型名。
    pub model: Option<String>,
    /// prompt token 数。
    pub prompt_tokens: Option<u64>,
    /// completion token 数。
    pub completion_tokens: Option<u64>,
    /// 失败原因（已打码，可直接展示）。
    pub error: Option<String>,
}

/// AI 模型列表结果（Rust -> 前端）。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiListModelsResult {
    /// 是否成功。
    pub ok: bool,
    /// HTTP 状态码（本地前置失败为 0）。
    pub status: u16,
    /// 模型名列表。
    pub models: Vec<String>,
    /// 失败原因（已打码，可直接展示）。
    pub error: Option<String>,
}

/// AI 密钥状态结果（Rust -> 前端）。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSecretStatusResult {
    /// 是否已配置密钥。
    pub configured: bool,
    /// 安全存储是否可用（条目不存在时为 `true`）。
    pub secure_storage_available: bool,
}
