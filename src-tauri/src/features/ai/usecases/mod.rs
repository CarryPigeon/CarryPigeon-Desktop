//! ai｜用例层：密钥保管与 OpenAI 兼容调用的编排。
//!
//! 语义约定（前端按 `ok` 分支，不依赖 IPC 报错）：
//! - 需要密钥但未配置 → `ok = false`、`status = 0`、`error = "api key is not configured"`；
//! - 不需要密钥且未配置 → 不带 `Authorization` 头继续请求；
//! - 已保存密钥 → 无论是否需要都附带（自建网关常要求鉴权）；
//! - 上游非 2xx / 解析失败 / 传输失败 → `ok = false` 且错误文本已打码；
//! - 参数校验失败 → 返回 `Err`，由命令边界映射 `[AI_INVALID_*]`。
//!
//! 约定：注释中文，日志英文（tracing）。

use crate::features::ai::domain::model::{
    AiChatMessage, AiChatRequest, AiModelsRequest, AiResponseParseError, AiUpstreamError,
    AiValidationError, build_chat_completions_url, build_models_url, extract_upstream_error,
    normalize_temperature, normalize_timeout_ms, redact_secret,
};
use crate::features::ai::domain::ports::{AiChatPort, AiModelsPort, AiSecretStorePort};
use crate::shared::secure_store::{
    is_secure_storage_unavailable_error, sanitize_account_component,
};

/// 未配置密钥时的稳定错误文本（前端可据此提示）。
const API_KEY_NOT_CONFIGURED: &str = "api key is not configured";
/// 2xx 成功响应对外的状态码（端口不暴露真实状态码，统一按 200 呈现）。
const SUCCESS_STATUS: u16 = 200;

/// AI 聊天补全用例入参。
#[derive(Debug, Clone)]
pub struct AiChatCompletionInput {
    /// provider 标识（用于定位 keyring 条目）。
    pub provider_id: String,
    /// 上游 base url。
    pub base_url: String,
    /// 模型名。
    pub model: String,
    /// 消息列表。
    pub messages: Vec<AiChatMessage>,
    /// 采样温度（可选）。
    pub temperature: Option<f64>,
    /// 最大输出 token 数（可选）。
    pub max_tokens: Option<u32>,
    /// 请求超时（毫秒，可选）。
    pub timeout_ms: Option<u64>,
    /// 是否要求必须配置密钥。
    pub requires_api_key: bool,
}

/// AI 聊天补全用例出参。
#[derive(Debug, Clone)]
pub struct AiChatCompletionOutput {
    /// 是否成功。
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

impl AiChatCompletionOutput {
    /// 构造失败结果（前端按 `ok` 分支，不使用 IPC 报错）。
    fn failed(status: u16, error: impl Into<String>) -> Self {
        Self {
            ok: false,
            status,
            content: String::new(),
            model: None,
            prompt_tokens: None,
            completion_tokens: None,
            error: Some(error.into()),
        }
    }
}

/// AI 模型列表用例入参。
#[derive(Debug, Clone)]
pub struct AiListModelsInput {
    /// provider 标识（用于定位 keyring 条目）。
    pub provider_id: String,
    /// 上游 base url。
    pub base_url: String,
    /// 请求超时（毫秒，可选）。
    pub timeout_ms: Option<u64>,
    /// 是否要求必须配置密钥。
    pub requires_api_key: bool,
}

/// AI 模型列表用例出参。
#[derive(Debug, Clone)]
pub struct AiListModelsOutput {
    /// 是否成功。
    pub ok: bool,
    /// HTTP 状态码（本地前置失败为 0）。
    pub status: u16,
    /// 模型名列表。
    pub models: Vec<String>,
    /// 失败原因（已打码，可直接展示）。
    pub error: Option<String>,
}

/// AI 密钥状态用例出参。
#[derive(Debug, Clone)]
pub struct AiSecretStatusOutput {
    /// 是否已配置密钥。
    pub configured: bool,
    /// 安全存储是否可用（条目不存在时为 `true`）。
    pub secure_storage_available: bool,
}

/// 执行一次聊天补全。
pub async fn ai_chat_completion(
    req: AiChatCompletionInput,
    chat_port: &dyn AiChatPort,
    secret_port: &dyn AiSecretStorePort,
) -> anyhow::Result<AiChatCompletionOutput> {
    let provider_id = validate_provider_id(&req.provider_id)?;
    let url = build_chat_completions_url(&req.base_url).map_err(invalid_base_url)?;

    let model = req.model.trim().to_string();
    if model.is_empty() {
        return Err(invalid_request("model is required"));
    }
    if req.messages.is_empty() {
        return Err(invalid_request("messages are required"));
    }

    let secret = load_secret(&provider_id, secret_port);
    if req.requires_api_key && secret.is_none() {
        return Ok(AiChatCompletionOutput::failed(0, API_KEY_NOT_CONFIGURED));
    }

    // 传入规范化后的完整地址（端口层再次调用构造函数是幂等的）。
    let request = AiChatRequest {
        base_url: url.to_string(),
        model,
        messages: req.messages,
        temperature: normalize_temperature(req.temperature),
        max_tokens: req.max_tokens,
        timeout_ms: normalize_timeout_ms(req.timeout_ms),
        api_key: secret.clone(),
    };

    match chat_port.chat_completion(request).await {
        Ok(outcome) => Ok(AiChatCompletionOutput {
            ok: true,
            status: SUCCESS_STATUS,
            content: outcome.content,
            model: outcome.model,
            prompt_tokens: outcome.prompt_tokens,
            completion_tokens: outcome.completion_tokens,
            error: None,
        }),
        Err(err) => Ok(map_chat_error(err, secret.as_deref(), &provider_id)),
    }
}

/// 拉取模型列表。
pub async fn ai_list_models(
    req: AiListModelsInput,
    models_port: &dyn AiModelsPort,
    secret_port: &dyn AiSecretStorePort,
) -> anyhow::Result<AiListModelsOutput> {
    let provider_id = validate_provider_id(&req.provider_id)?;
    let url = build_models_url(&req.base_url).map_err(invalid_base_url)?;

    let secret = load_secret(&provider_id, secret_port);
    if req.requires_api_key && secret.is_none() {
        return Ok(AiListModelsOutput {
            ok: false,
            status: 0,
            models: Vec::new(),
            error: Some(API_KEY_NOT_CONFIGURED.to_string()),
        });
    }

    let request = AiModelsRequest {
        base_url: url.to_string(),
        timeout_ms: normalize_timeout_ms(req.timeout_ms),
        api_key: secret.clone(),
    };

    match models_port.list_models(request).await {
        Ok(models) => Ok(AiListModelsOutput {
            ok: true,
            status: SUCCESS_STATUS,
            models,
            error: None,
        }),
        Err(err) => Ok(map_models_error(err, secret.as_deref(), &provider_id)),
    }
}

/// 保存（覆盖）密钥。
pub fn ai_secret_set(
    provider_id: &str,
    api_key: &str,
    port: &dyn AiSecretStorePort,
) -> anyhow::Result<()> {
    let provider_id = validate_provider_id(provider_id)?;
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err(invalid_request("api key is required"));
    }
    port.set_secret(&provider_id, api_key)
}

/// 查询密钥状态（不返回密钥内容）。
pub fn ai_secret_status(
    provider_id: &str,
    port: &dyn AiSecretStorePort,
) -> anyhow::Result<AiSecretStatusOutput> {
    let provider_id = validate_provider_id(provider_id)?;
    match port.get_secret(&provider_id) {
        Ok(secret) => Ok(AiSecretStatusOutput {
            configured: secret
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false),
            secure_storage_available: true,
        }),
        Err(err) => {
            let message = format!("{err}");
            if is_secure_storage_unavailable_error(&message) {
                tracing::warn!(
                    action = "app_ai_secret_status_unavailable",
                    provider_id = %provider_id,
                    error = %message
                );
                return Ok(AiSecretStatusOutput {
                    configured: false,
                    secure_storage_available: false,
                });
            }
            Err(err)
        }
    }
}

/// 清除密钥（幂等）。
pub fn ai_secret_clear(provider_id: &str, port: &dyn AiSecretStorePort) -> anyhow::Result<()> {
    let provider_id = validate_provider_id(provider_id)?;
    port.delete_secret(&provider_id)
}

/// 校验并规范化 provider id（白名单字符 + 长度上限）。
fn validate_provider_id(raw: &str) -> anyhow::Result<String> {
    sanitize_account_component(raw)
        .map_err(|e| anyhow::Error::new(AiValidationError::InvalidProviderId(format!("{e}"))))
}

/// 构造 base url 校验错误。
fn invalid_base_url(err: anyhow::Error) -> anyhow::Error {
    anyhow::Error::new(AiValidationError::InvalidBaseUrl(format!("{err}")))
}

/// 构造请求参数校验错误。
fn invalid_request(message: &str) -> anyhow::Error {
    anyhow::Error::new(AiValidationError::InvalidRequest(message.to_string()))
}

/// 读取密钥用于上游调用。
///
/// 读取失败（含安全存储不可用）一律降级为“无密钥”并告警：本地部署（Ollama 等）
/// 不应因为系统安全存储故障而不可用；需要密钥的场景会以 `api key is not configured`
/// 明确返回给前端。
fn load_secret(provider_id: &str, secret_port: &dyn AiSecretStorePort) -> Option<String> {
    match secret_port.get_secret(provider_id) {
        Ok(secret) => secret.filter(|value| !value.trim().is_empty()),
        Err(err) => {
            let message = format!("{err}");
            if is_secure_storage_unavailable_error(&message) {
                tracing::warn!(
                    action = "app_ai_secret_read_unavailable",
                    provider_id = %provider_id,
                    error = %message
                );
            } else {
                tracing::warn!(
                    action = "app_ai_secret_read_failed",
                    provider_id = %provider_id,
                    error = %message
                );
            }
            None
        }
    }
}

/// 将聊天端口错误映射为前端可分支的失败结果（任何情况下都不返回 `Err`）。
fn map_chat_error(
    err: anyhow::Error,
    secret: Option<&str>,
    provider_id: &str,
) -> AiChatCompletionOutput {
    if let Some(upstream) = err.downcast_ref::<AiUpstreamError>() {
        let message = redact_secret(
            &extract_upstream_error(&upstream.body, upstream.status),
            secret,
        );
        tracing::warn!(
            action = "app_ai_chat_upstream_failed",
            provider_id = %provider_id,
            status = upstream.status,
            error = %message
        );
        return AiChatCompletionOutput::failed(upstream.status, message);
    }
    if let Some(parse) = err.downcast_ref::<AiResponseParseError>() {
        let message = redact_secret(&parse.message, secret);
        tracing::warn!(
            action = "app_ai_chat_response_parse_failed",
            provider_id = %provider_id,
            status = parse.status,
            error = %message
        );
        return AiChatCompletionOutput::failed(parse.status, message);
    }
    let message = redact_secret(&format!("{err}"), secret);
    tracing::warn!(
        action = "app_ai_chat_request_failed",
        provider_id = %provider_id,
        error = %message
    );
    AiChatCompletionOutput::failed(0, message)
}

/// 将模型列表端口错误映射为前端可分支的失败结果。
fn map_models_error(
    err: anyhow::Error,
    secret: Option<&str>,
    provider_id: &str,
) -> AiListModelsOutput {
    let (status, message) = if let Some(upstream) = err.downcast_ref::<AiUpstreamError>() {
        (
            upstream.status,
            extract_upstream_error(&upstream.body, upstream.status),
        )
    } else if let Some(parse) = err.downcast_ref::<AiResponseParseError>() {
        (parse.status, parse.message.clone())
    } else {
        (0, format!("{err}"))
    };
    let message = redact_secret(&message, secret);
    tracing::warn!(
        action = "app_ai_models_request_failed",
        provider_id = %provider_id,
        status = status,
        error = %message
    );
    AiListModelsOutput {
        ok: false,
        status,
        models: Vec::new(),
        error: Some(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::ai::domain::model::AiChatOutcome;
    use crate::features::ai::domain::ports::{AiChatFuture, AiModelsFuture};
    use std::sync::Mutex;

    /// 假聊天端口：记录最后一次请求，并按预设脚本返回。
    #[derive(Debug, Clone)]
    enum FakeReply {
        Ok(AiChatOutcome),
        Upstream { status: u16, body: String },
        Parse { status: u16, message: String },
        Transport(String),
    }

    struct FakeChatPort {
        reply: Mutex<FakeReply>,
        last_request: Mutex<Option<AiChatRequest>>,
    }

    impl FakeChatPort {
        fn new(reply: FakeReply) -> Self {
            Self {
                reply: Mutex::new(reply),
                last_request: Mutex::new(None),
            }
        }

        fn last_request(&self) -> Option<AiChatRequest> {
            self.last_request
                .lock()
                .ok()
                .and_then(|guard| guard.clone())
        }
    }

    impl AiChatPort for FakeChatPort {
        fn chat_completion<'a>(&'a self, request: AiChatRequest) -> AiChatFuture<'a> {
            Box::pin(async move {
                if let Ok(mut guard) = self.last_request.lock() {
                    *guard = Some(request.clone());
                }
                let reply = self
                    .reply
                    .lock()
                    .map_err(|_| anyhow::anyhow!("fake chat port lock poisoned"))?;
                match &*reply {
                    FakeReply::Ok(outcome) => Ok(outcome.clone()),
                    FakeReply::Upstream { status, body } => {
                        Err(anyhow::Error::new(AiUpstreamError {
                            status: *status,
                            body: body.clone(),
                        }))
                    }
                    FakeReply::Parse { status, message } => {
                        Err(anyhow::Error::new(AiResponseParseError {
                            status: *status,
                            message: message.clone(),
                        }))
                    }
                    FakeReply::Transport(message) => Err(anyhow::anyhow!("{message}")),
                }
            })
        }
    }

    /// 假模型列表端口。
    struct FakeModelsPort {
        reply: Mutex<Result<Vec<String>, FakeReply>>,
        last_request: Mutex<Option<AiModelsRequest>>,
    }

    impl FakeModelsPort {
        fn ok(models: Vec<&str>) -> Self {
            Self {
                reply: Mutex::new(Ok(models.into_iter().map(str::to_string).collect())),
                last_request: Mutex::new(None),
            }
        }

        fn failing(reply: FakeReply) -> Self {
            Self {
                reply: Mutex::new(Err(reply)),
                last_request: Mutex::new(None),
            }
        }

        fn last_request(&self) -> Option<AiModelsRequest> {
            self.last_request
                .lock()
                .ok()
                .and_then(|guard| guard.clone())
        }
    }

    impl AiModelsPort for FakeModelsPort {
        fn list_models<'a>(&'a self, request: AiModelsRequest) -> AiModelsFuture<'a> {
            Box::pin(async move {
                if let Ok(mut guard) = self.last_request.lock() {
                    *guard = Some(request.clone());
                }
                let reply = self
                    .reply
                    .lock()
                    .map_err(|_| anyhow::anyhow!("fake models port lock poisoned"))?;
                match &*reply {
                    Ok(models) => Ok(models.clone()),
                    Err(FakeReply::Upstream { status, body }) => {
                        Err(anyhow::Error::new(AiUpstreamError {
                            status: *status,
                            body: body.clone(),
                        }))
                    }
                    Err(FakeReply::Parse { status, message }) => {
                        Err(anyhow::Error::new(AiResponseParseError {
                            status: *status,
                            message: message.clone(),
                        }))
                    }
                    Err(FakeReply::Transport(message)) => Err(anyhow::anyhow!("{message}")),
                    Err(FakeReply::Ok(_)) => Err(anyhow::anyhow!("fake models port misuse")),
                }
            })
        }
    }

    /// 假密钥存储：可注入读/写故障，并记录调用参数。
    #[derive(Default)]
    struct FakeSecretStore {
        secret: Mutex<Option<String>>,
        read_error: Mutex<Option<String>>,
        write_error: Mutex<Option<String>>,
        last_provider_id: Mutex<Option<String>>,
        delete_calls: Mutex<u32>,
    }

    impl FakeSecretStore {
        fn with_secret(secret: &str) -> Self {
            Self {
                secret: Mutex::new(Some(secret.to_string())),
                ..Self::default()
            }
        }

        fn with_read_error(message: &str) -> Self {
            Self {
                read_error: Mutex::new(Some(message.to_string())),
                ..Self::default()
            }
        }

        fn with_write_error(message: &str) -> Self {
            Self {
                write_error: Mutex::new(Some(message.to_string())),
                ..Self::default()
            }
        }

        fn last_provider_id(&self) -> Option<String> {
            self.last_provider_id
                .lock()
                .ok()
                .and_then(|guard| guard.clone())
        }

        fn delete_calls(&self) -> u32 {
            self.delete_calls.lock().map(|guard| *guard).unwrap_or(0)
        }
    }

    impl AiSecretStorePort for FakeSecretStore {
        fn get_secret(&self, provider_id: &str) -> anyhow::Result<Option<String>> {
            if let Ok(mut guard) = self.last_provider_id.lock() {
                *guard = Some(provider_id.to_string());
            }
            if let Some(message) = self.read_error.lock().ok().and_then(|guard| guard.clone()) {
                return Err(anyhow::anyhow!("{message}"));
            }
            Ok(self.secret.lock().ok().and_then(|guard| guard.clone()))
        }

        fn set_secret(&self, provider_id: &str, secret: &str) -> anyhow::Result<()> {
            if let Ok(mut guard) = self.last_provider_id.lock() {
                *guard = Some(provider_id.to_string());
            }
            if let Some(message) = self.write_error.lock().ok().and_then(|guard| guard.clone()) {
                return Err(anyhow::anyhow!("{message}"));
            }
            if let Ok(mut guard) = self.secret.lock() {
                *guard = Some(secret.to_string());
            }
            Ok(())
        }

        fn delete_secret(&self, provider_id: &str) -> anyhow::Result<()> {
            if let Ok(mut guard) = self.last_provider_id.lock() {
                *guard = Some(provider_id.to_string());
            }
            if let Ok(mut guard) = self.delete_calls.lock() {
                *guard += 1;
            }
            if let Ok(mut guard) = self.secret.lock() {
                *guard = None;
            }
            Ok(())
        }
    }

    fn message(role: &str, content: &str) -> AiChatMessage {
        AiChatMessage {
            role: role.to_string(),
            content: content.to_string(),
        }
    }

    fn chat_input(requires_api_key: bool) -> AiChatCompletionInput {
        AiChatCompletionInput {
            provider_id: "openai".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            model: "gpt-4o-mini".to_string(),
            messages: vec![message("user", "hi")],
            temperature: Some(0.5),
            max_tokens: Some(128),
            timeout_ms: None,
            requires_api_key,
        }
    }

    fn models_input(requires_api_key: bool) -> AiListModelsInput {
        AiListModelsInput {
            provider_id: "openai".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            timeout_ms: None,
            requires_api_key,
        }
    }

    fn ok_outcome() -> AiChatOutcome {
        AiChatOutcome {
            content: "hello".to_string(),
            model: Some("gpt-4o-mini".to_string()),
            prompt_tokens: Some(3),
            completion_tokens: Some(4),
        }
    }

    #[tokio::test]
    async fn chat_requires_api_key_without_secret_skips_upstream() {
        let chat_port = FakeChatPort::new(FakeReply::Ok(ok_outcome()));
        let secret_port = FakeSecretStore::default();

        let output = ai_chat_completion(chat_input(true), &chat_port, &secret_port)
            .await
            .expect("usecase should not fail");

        assert!(!output.ok);
        assert_eq!(output.status, 0);
        assert_eq!(output.error.as_deref(), Some("api key is not configured"));
        assert!(output.content.is_empty());
        assert!(
            chat_port.last_request().is_none(),
            "未配置密钥时不得发起上游请求"
        );
    }

    #[tokio::test]
    async fn chat_without_key_omits_authorization_and_normalizes_options() {
        let chat_port = FakeChatPort::new(FakeReply::Ok(ok_outcome()));
        let secret_port = FakeSecretStore::default();

        let mut input = chat_input(false);
        input.temperature = Some(9.5);
        input.timeout_ms = Some(1);
        let output = ai_chat_completion(input, &chat_port, &secret_port)
            .await
            .expect("usecase should not fail");

        assert!(output.ok);
        assert_eq!(output.status, 200);
        assert_eq!(output.content, "hello");
        assert_eq!(output.prompt_tokens, Some(3));
        assert_eq!(output.completion_tokens, Some(4));
        assert!(output.error.is_none());

        let request = chat_port
            .last_request()
            .expect("chat port should be called");
        assert!(request.api_key.is_none());
        assert_eq!(request.temperature, Some(2.0));
        // 超时下界夹取：Some(1) -> 1000ms（默认 30000ms 的用例见模型层单测）。
        assert_eq!(request.timeout_ms, 1_000);
        assert_eq!(request.max_tokens, Some(128));
        assert_eq!(
            request.base_url,
            "https://api.openai.com/v1/chat/completions"
        );
    }

    #[tokio::test]
    async fn chat_attaches_stored_secret_even_when_not_required() {
        let chat_port = FakeChatPort::new(FakeReply::Ok(ok_outcome()));
        let secret_port = FakeSecretStore::with_secret("sk-stored");

        let output = ai_chat_completion(chat_input(false), &chat_port, &secret_port)
            .await
            .expect("usecase should not fail");

        assert!(output.ok);
        let request = chat_port
            .last_request()
            .expect("chat port should be called");
        assert_eq!(request.api_key.as_deref(), Some("sk-stored"));
    }

    #[tokio::test]
    async fn chat_upstream_error_keeps_status_and_redacts_secret() {
        let chat_port = FakeChatPort::new(FakeReply::Upstream {
            status: 401,
            body: r#"{ "error": { "message": "invalid key sk-secret" } }"#.to_string(),
        });
        let secret_port = FakeSecretStore::with_secret("sk-secret");

        let output = ai_chat_completion(chat_input(false), &chat_port, &secret_port)
            .await
            .expect("usecase should not fail");

        assert!(!output.ok);
        assert_eq!(output.status, 401);
        let error = output.error.expect("error message");
        assert!(error.contains("***"), "unexpected error text: {error}");
        assert!(!error.contains("sk-secret"), "secret leaked: {error}");
    }

    #[tokio::test]
    async fn chat_parse_failure_keeps_status() {
        let chat_port = FakeChatPort::new(FakeReply::Parse {
            status: 200,
            message: "AI chat response is missing 'choices[0].message.content'".to_string(),
        });
        let secret_port = FakeSecretStore::default();

        let output = ai_chat_completion(chat_input(false), &chat_port, &secret_port)
            .await
            .expect("usecase should not fail");

        assert!(!output.ok);
        assert_eq!(output.status, 200);
        assert!(
            output
                .error
                .as_deref()
                .unwrap_or_default()
                .contains("choices[0].message.content")
        );
    }

    #[tokio::test]
    async fn chat_transport_error_returns_status_zero() {
        let chat_port = FakeChatPort::new(FakeReply::Transport(
            "Failed to send AI chat request: timed out".to_string(),
        ));
        let secret_port = FakeSecretStore::default();

        let output = ai_chat_completion(chat_input(false), &chat_port, &secret_port)
            .await
            .expect("usecase should not fail");

        assert!(!output.ok);
        assert_eq!(output.status, 0);
        assert!(
            output
                .error
                .as_deref()
                .unwrap_or_default()
                .contains("timed out")
        );
    }

    #[tokio::test]
    async fn chat_secret_read_failure_degrades_to_no_key() {
        let chat_port = FakeChatPort::new(FakeReply::Ok(ok_outcome()));
        let secret_port = FakeSecretStore::with_read_error(
            "secure storage is unavailable: No default store has been set",
        );

        let output = ai_chat_completion(chat_input(false), &chat_port, &secret_port)
            .await
            .expect("usecase should not fail");

        assert!(output.ok, "本地/无鉴权调用不应被安全存储故障阻断");
        assert!(
            chat_port
                .last_request()
                .expect("chat port should be called")
                .api_key
                .is_none()
        );
    }

    #[tokio::test]
    async fn chat_rejects_invalid_arguments() {
        let chat_port = FakeChatPort::new(FakeReply::Ok(ok_outcome()));
        let secret_port = FakeSecretStore::default();

        let mut input = chat_input(false);
        input.base_url = "file:///etc/passwd".to_string();
        let err = ai_chat_completion(input, &chat_port, &secret_port)
            .await
            .expect_err("invalid base url must fail");
        assert!(matches!(
            err.downcast_ref::<AiValidationError>(),
            Some(AiValidationError::InvalidBaseUrl(_))
        ));

        let mut input = chat_input(false);
        input.model = "   ".to_string();
        let err = ai_chat_completion(input, &chat_port, &secret_port)
            .await
            .expect_err("empty model must fail");
        assert!(matches!(
            err.downcast_ref::<AiValidationError>(),
            Some(AiValidationError::InvalidRequest(_))
        ));

        let mut input = chat_input(false);
        input.messages = Vec::new();
        let err = ai_chat_completion(input, &chat_port, &secret_port)
            .await
            .expect_err("empty messages must fail");
        assert!(matches!(
            err.downcast_ref::<AiValidationError>(),
            Some(AiValidationError::InvalidRequest(_))
        ));
    }

    #[tokio::test]
    async fn chat_normalizes_provider_id_before_touching_keyring() {
        let chat_port = FakeChatPort::new(FakeReply::Ok(ok_outcome()));
        let secret_port = FakeSecretStore::default();

        let mut input = chat_input(false);
        input.provider_id = "  OpenAI  ".to_string();
        let output = ai_chat_completion(input, &chat_port, &secret_port)
            .await
            .expect("usecase should not fail");

        assert!(output.ok);
        assert_eq!(secret_port.last_provider_id().as_deref(), Some("openai"));

        let mut input = chat_input(false);
        input.provider_id = "a/b".to_string();
        let err = ai_chat_completion(input, &chat_port, &secret_port)
            .await
            .expect_err("unsafe provider id must fail");
        assert!(matches!(
            err.downcast_ref::<AiValidationError>(),
            Some(AiValidationError::InvalidProviderId(_))
        ));
    }

    #[tokio::test]
    async fn models_returns_list_on_success() {
        let models_port = FakeModelsPort::ok(vec!["a", "b"]);
        let secret_port = FakeSecretStore::default();

        let output = ai_list_models(models_input(false), &models_port, &secret_port)
            .await
            .expect("usecase should not fail");

        assert!(output.ok);
        assert_eq!(output.status, 200);
        assert_eq!(output.models, vec!["a", "b"]);
        assert!(output.error.is_none());

        let request = models_port.last_request().expect("models port called");
        assert_eq!(request.timeout_ms, 30_000);
        assert!(request.api_key.is_none());
        assert_eq!(request.base_url, "https://api.openai.com/v1/models");
    }

    #[tokio::test]
    async fn models_requires_api_key_without_secret() {
        let models_port = FakeModelsPort::ok(vec!["a"]);
        let secret_port = FakeSecretStore::default();

        let output = ai_list_models(models_input(true), &models_port, &secret_port)
            .await
            .expect("usecase should not fail");

        assert!(!output.ok);
        assert_eq!(output.status, 0);
        assert!(output.models.is_empty());
        assert_eq!(output.error.as_deref(), Some("api key is not configured"));
        assert!(models_port.last_request().is_none());
    }

    #[tokio::test]
    async fn models_upstream_error_is_redacted() {
        let models_port = FakeModelsPort::failing(FakeReply::Upstream {
            status: 403,
            body: r#"{ "error": { "message": "forbidden for sk-secret" } }"#.to_string(),
        });
        let secret_port = FakeSecretStore::with_secret("sk-secret");

        let output = ai_list_models(models_input(false), &models_port, &secret_port)
            .await
            .expect("usecase should not fail");

        assert!(!output.ok);
        assert_eq!(output.status, 403);
        let error = output.error.expect("error message");
        assert!(error.contains("***") && !error.contains("sk-secret"));
    }

    #[tokio::test]
    async fn models_transport_error_returns_status_zero() {
        let models_port =
            FakeModelsPort::failing(FakeReply::Transport("connection refused".into()));
        let secret_port = FakeSecretStore::default();

        let output = ai_list_models(models_input(false), &models_port, &secret_port)
            .await
            .expect("usecase should not fail");

        assert!(!output.ok);
        assert_eq!(output.status, 0);
        assert!(
            output
                .error
                .as_deref()
                .unwrap_or_default()
                .contains("connection refused")
        );
    }

    #[test]
    fn secret_roundtrip_and_validation() {
        let store = FakeSecretStore::default();

        assert!(
            !ai_secret_status("openai", &store)
                .expect("status")
                .configured
        );

        ai_secret_set("OpenAI", "  sk-1  ", &store).expect("set secret");
        assert_eq!(store.last_provider_id().as_deref(), Some("openai"));
        let status = ai_secret_status("openai", &store).expect("status");
        assert!(status.configured);
        assert!(status.secure_storage_available);

        ai_secret_clear("openai", &store).expect("clear secret");
        assert_eq!(store.delete_calls(), 1);
        assert!(
            !ai_secret_status("openai", &store)
                .expect("status")
                .configured
        );

        let err = ai_secret_set("openai", "   ", &store).expect_err("empty key must fail");
        assert!(matches!(
            err.downcast_ref::<AiValidationError>(),
            Some(AiValidationError::InvalidRequest(_))
        ));

        let err = ai_secret_set("bad id", "sk-1", &store).expect_err("bad id must fail");
        assert!(matches!(
            err.downcast_ref::<AiValidationError>(),
            Some(AiValidationError::InvalidProviderId(_))
        ));

        let err = ai_secret_clear("", &store).expect_err("empty id must fail");
        assert!(matches!(
            err.downcast_ref::<AiValidationError>(),
            Some(AiValidationError::InvalidProviderId(_))
        ));
    }

    #[test]
    fn secret_status_reports_unavailable_storage() {
        let store = FakeSecretStore::with_read_error(
            "secure storage is unavailable: No default store has been set",
        );
        let status = ai_secret_status("openai", &store).expect("status");
        assert!(!status.configured);
        assert!(!status.secure_storage_available);
    }

    #[test]
    fn secret_status_surfaces_unknown_storage_errors() {
        let store = FakeSecretStore::with_read_error("Failed to read secure storage entry: boom");
        assert!(ai_secret_status("openai", &store).is_err());
    }

    #[test]
    fn secret_set_reports_unavailable_storage() {
        let store =
            FakeSecretStore::with_write_error("secure storage is unavailable: platform failure");
        let err = ai_secret_set("openai", "sk-1", &store).expect_err("write must fail");
        assert!(is_secure_storage_unavailable_error(&format!("{err}")));
    }
}
