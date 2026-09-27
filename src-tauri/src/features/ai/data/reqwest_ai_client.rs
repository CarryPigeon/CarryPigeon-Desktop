//! ai｜数据层：基于 reqwest 的 OpenAI 兼容客户端。
//!
//! 约定：注释中文，日志英文（tracing）；日志只记录 URL/模型/是否携带密钥，
//! **绝不记录密钥内容与请求体**。

use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;

use crate::features::ai::domain::model::{
    AiChatOutcome, AiChatRequest, AiModelsRequest, AiResponseParseError, AiUpstreamError,
    build_chat_completions_url, build_models_url, parse_chat_completion, parse_models_list,
};
use crate::features::ai::domain::ports::{AiChatFuture, AiChatPort, AiModelsFuture, AiModelsPort};

/// 单次 AI 响应体读取上限（2 MiB）：防止上游返回超大响应体耗尽内存。
const AI_RESPONSE_BODY_MAX_BYTES: u64 = 2 * 1024 * 1024;

/// OpenAI 兼容 AI 客户端（同时实现聊天补全与模型列表端口）。
#[derive(Debug, Default)]
pub struct ReqwestAiClient;

impl ReqwestAiClient {
    /// 构造共享实例（无状态，便于 DI 注入）。
    pub fn shared() -> Arc<Self> {
        Arc::new(Self)
    }
}

impl AiChatPort for ReqwestAiClient {
    fn chat_completion<'a>(&'a self, request: AiChatRequest) -> AiChatFuture<'a> {
        Box::pin(async move { chat_completion_impl(request).await })
    }
}

impl AiModelsPort for ReqwestAiClient {
    fn list_models<'a>(&'a self, request: AiModelsRequest) -> AiModelsFuture<'a> {
        Box::pin(async move { list_models_impl(request).await })
    }
}

/// 按调用参数构建客户端：每次调用独立超时，且不跟随重定向
/// （避免把 Bearer 密钥随 302 投递到第三方主机）。
fn build_client(timeout_ms: u64) -> anyhow::Result<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| anyhow::anyhow!("Failed to build AI http client: {e}"))
}

/// 提取可用的 Bearer token：空串/纯空白视为未配置（本地 Ollama 无需密钥）。
fn auth_token(api_key: Option<&str>) -> Option<&str> {
    api_key.map(str::trim).filter(|key| !key.is_empty())
}

/// 执行聊天补全请求。
async fn chat_completion_impl(request: AiChatRequest) -> anyhow::Result<AiChatOutcome> {
    let AiChatRequest {
        base_url,
        model,
        messages,
        temperature,
        max_tokens,
        timeout_ms,
        api_key,
    } = request;

    let url = build_chat_completions_url(&base_url)?;

    let mut payload = serde_json::Map::new();
    payload.insert(
        "model".to_string(),
        serde_json::Value::String(model.clone()),
    );
    payload.insert(
        "messages".to_string(),
        serde_json::to_value(&messages)
            .map_err(|e| anyhow::anyhow!("Failed to encode AI chat messages: {e}"))?,
    );
    if let Some(temperature) = temperature {
        payload.insert(
            "temperature".to_string(),
            serde_json::Value::from(temperature),
        );
    }
    if let Some(max_tokens) = max_tokens {
        payload.insert(
            "max_tokens".to_string(),
            serde_json::Value::from(max_tokens),
        );
    }

    let client = build_client(timeout_ms)?;
    let mut request_builder = client
        .post(url.clone())
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&serde_json::Value::Object(payload));
    if let Some(token) = auth_token(api_key.as_deref()) {
        request_builder =
            request_builder.header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"));
    }

    tracing::debug!(
        action = "app_ai_chat_request_sending",
        url = %url,
        model = %model,
        has_api_key = api_key.is_some(),
        timeout_ms = timeout_ms
    );

    let response = request_builder
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to send AI chat request: {e}"))?;

    let status = response.status().as_u16();
    let success = response.status().is_success();
    match read_body_limited(response).await {
        Ok(body) => {
            if !success {
                return Err(anyhow::Error::new(AiUpstreamError { status, body }));
            }
            parse_chat_completion(&body).map_err(|e| {
                anyhow::Error::new(AiResponseParseError {
                    status,
                    message: format!("{e}"),
                })
            })
        }
        Err(err) => {
            // 读取失败（超限/传输中断）：非 2xx 时仍保留状态码，避免丢失上游错误语义。
            if !success {
                return Err(anyhow::Error::new(AiUpstreamError {
                    status,
                    body: String::new(),
                }));
            }
            Err(err)
        }
    }
}

/// 执行模型列表请求。
async fn list_models_impl(request: AiModelsRequest) -> anyhow::Result<Vec<String>> {
    let AiModelsRequest {
        base_url,
        timeout_ms,
        api_key,
    } = request;

    let url = build_models_url(&base_url)?;
    let client = build_client(timeout_ms)?;
    let mut request_builder = client.get(url.clone());
    if let Some(token) = auth_token(api_key.as_deref()) {
        request_builder =
            request_builder.header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"));
    }

    tracing::debug!(
        action = "app_ai_models_request_sending",
        url = %url,
        has_api_key = api_key.is_some(),
        timeout_ms = timeout_ms
    );

    let response = request_builder
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to send AI models request: {e}"))?;

    let status = response.status().as_u16();
    let success = response.status().is_success();
    match read_body_limited(response).await {
        Ok(body) => {
            if !success {
                return Err(anyhow::Error::new(AiUpstreamError { status, body }));
            }
            parse_models_list(&body).map_err(|e| {
                anyhow::Error::new(AiResponseParseError {
                    status,
                    message: format!("{e}"),
                })
            })
        }
        Err(err) => {
            if !success {
                return Err(anyhow::Error::new(AiUpstreamError {
                    status,
                    body: String::new(),
                }));
            }
            Err(err)
        }
    }
}

/// 读取响应体（带大小上限）；超限或读取中断返回 `Err`。
async fn read_body_limited(response: reqwest::Response) -> anyhow::Result<String> {
    if response.content_length().unwrap_or(0) > AI_RESPONSE_BODY_MAX_BYTES {
        return Err(anyhow::anyhow!("AI response body is too large"));
    }

    let mut stream = response.bytes_stream();
    let mut buffer: Vec<u8> = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| anyhow::anyhow!("Failed to read AI response body: {e}"))?;
        if buffer.len() as u64 + chunk.len() as u64 > AI_RESPONSE_BODY_MAX_BYTES {
            return Err(anyhow::anyhow!("AI response body is too large"));
        }
        buffer.extend_from_slice(&chunk);
    }
    Ok(String::from_utf8_lossy(&buffer).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::ai::domain::model::AiChatMessage;

    #[test]
    fn auth_token_ignores_blank_keys() {
        assert_eq!(auth_token(None), None);
        assert_eq!(auth_token(Some("")), None);
        assert_eq!(auth_token(Some("   ")), None);
        assert_eq!(auth_token(Some(" sk-1 ")), Some("sk-1"));
    }

    #[test]
    fn build_client_uses_request_timeout_without_redirects() {
        // 仅验证构建成功（超时/重定向策略由 reqwest 内部保证）。
        assert!(build_client(1_000).is_ok());
        assert!(build_client(120_000).is_ok());
    }

    #[tokio::test]
    async fn chat_completion_rejects_invalid_base_url() {
        let client = ReqwestAiClient::shared();
        let request = AiChatRequest {
            base_url: "file:///etc/passwd".to_string(),
            model: "m".to_string(),
            messages: vec![AiChatMessage {
                role: "user".to_string(),
                content: "hi".to_string(),
            }],
            temperature: None,
            max_tokens: None,
            timeout_ms: 1_000,
            api_key: None,
        };
        let result = client.chat_completion(request).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn list_models_rejects_invalid_base_url() {
        let client = ReqwestAiClient::shared();
        let request = AiModelsRequest {
            base_url: "not-a-url".to_string(),
            timeout_ms: 1_000,
            api_key: None,
        };
        assert!(client.list_models(request).await.is_err());
    }
}
