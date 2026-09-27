//! ai｜领域模型：纯数据结构与纯函数（可单元测试）。
//!
//! 说明：本文件不依赖 Tauri/网络运行时，所有解析与归一化逻辑都是纯函数，
//! 便于对畸形上游响应做覆盖测试（任何形状都不得 panic）。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::fmt;

use anyhow::{Context, Result};

/// 默认请求超时（毫秒）。
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
/// 请求超时下界（毫秒）。
const MIN_TIMEOUT_MS: u64 = 1_000;
/// 请求超时上界（毫秒）。
const MAX_TIMEOUT_MS: u64 = 120_000;
/// 温度下界。
const MIN_TEMPERATURE: f64 = 0.0;
/// 温度上界。
const MAX_TEMPERATURE: f64 = 2.0;
/// 上游错误文本最大字符数（按 Unicode 标量截断，避免按字节截断破坏 UTF-8）。
const UPSTREAM_ERROR_MAX_CHARS: usize = 300;
/// OpenAI 兼容聊天补全路径。
const CHAT_COMPLETIONS_PATH: &str = "/chat/completions";
/// OpenAI 兼容模型列表路径。
const MODELS_PATH: &str = "/models";

/// AI 聊天消息。
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct AiChatMessage {
    /// 角色（`system` / `user` / `assistant`）。
    pub role: String,
    /// 文本内容。
    pub content: String,
}

/// AI 聊天补全请求（用例 -> 端口）。
#[derive(Debug, Clone)]
pub struct AiChatRequest {
    /// 上游 base url（可能已是完整 `/chat/completions` 地址）。
    pub base_url: String,
    /// 模型名。
    pub model: String,
    /// 消息列表。
    pub messages: Vec<AiChatMessage>,
    /// 采样温度（可选，已归一化）。
    pub temperature: Option<f64>,
    /// 最大输出 token 数（可选）。
    pub max_tokens: Option<u32>,
    /// 请求超时（毫秒，已归一化）。
    pub timeout_ms: u64,
    /// API Key（可选；为空/空白表示不带鉴权头）。
    pub api_key: Option<String>,
}

/// AI 模型列表请求（用例 -> 端口）。
#[derive(Debug, Clone)]
pub struct AiModelsRequest {
    /// 上游 base url（可能已是完整 `/models` 地址）。
    pub base_url: String,
    /// 请求超时（毫秒，已归一化）。
    pub timeout_ms: u64,
    /// API Key（可选；为空/空白表示不带鉴权头）。
    pub api_key: Option<String>,
}

/// AI 聊天补全结果（端口 -> 用例）。
#[derive(Debug, Clone)]
pub struct AiChatOutcome {
    /// 助手回复文本。
    pub content: String,
    /// 上游返回的模型名（可选）。
    pub model: Option<String>,
    /// prompt token 数（可选）。
    pub prompt_tokens: Option<u64>,
    /// completion token 数（可选）。
    pub completion_tokens: Option<u64>,
}

/// 用例层参数校验错误（命令边界据此映射稳定的 `[AI_INVALID_*]` 错误码）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AiValidationError {
    /// provider id 非法（字符白名单/长度校验未通过）。
    InvalidProviderId(String),
    /// base url 非法（为空、非 http(s)、无法解析）。
    InvalidBaseUrl(String),
    /// 其它请求参数非法（model/messages/api key 为空等）。
    InvalidRequest(String),
}

impl AiValidationError {
    /// 对应的稳定错误码（前端据此分支）。
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidProviderId(_) => "AI_INVALID_PROVIDER_ID",
            Self::InvalidBaseUrl(_) => "AI_INVALID_BASE_URL",
            Self::InvalidRequest(_) => "AI_INVALID_REQUEST",
        }
    }

    /// 对应的 i18n key。
    pub fn i18n_key(&self) -> &'static str {
        match self {
            Self::InvalidProviderId(_) => "error.ai_invalid_provider_id",
            Self::InvalidBaseUrl(_) => "error.ai_invalid_base_url",
            Self::InvalidRequest(_) => "error.ai_invalid_request",
        }
    }
}

impl fmt::Display for AiValidationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidProviderId(message) => write!(f, "Invalid AI provider id: {message}"),
            Self::InvalidBaseUrl(message) => write!(f, "Invalid AI base url: {message}"),
            Self::InvalidRequest(message) => write!(f, "Invalid AI request: {message}"),
        }
    }
}

impl std::error::Error for AiValidationError {}

/// 上游返回非 2xx：保留状态码与原始报文供用例层提取错误信息。
///
/// 注意：`Display` 只输出状态码，报文必须由用例层经 `extract_upstream_error` +
/// `redact_secret` 处理后才能离开进程。
#[derive(Debug)]
pub struct AiUpstreamError {
    /// HTTP 状态码。
    pub status: u16,
    /// 原始响应报文（可能包含敏感片段，禁止直接外泄）。
    pub body: String,
}

impl fmt::Display for AiUpstreamError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "AI upstream returned status {}", self.status)
    }
}

impl std::error::Error for AiUpstreamError {}

/// 2xx 响应体解析失败：保留状态码，使用例层能回填 `status`。
#[derive(Debug)]
pub struct AiResponseParseError {
    /// HTTP 状态码（解析失败前的 2xx）。
    pub status: u16,
    /// 解析失败原因（由本模块生成，不含上游报文片段）。
    pub message: String,
}

impl fmt::Display for AiResponseParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for AiResponseParseError {}

/// 构造聊天补全 URL。
///
/// 规则：trim 首尾空白后先校验基础地址（必须是带 host 的 http/https），
/// 路径已以 `/chat/completions` 结尾时原样使用（保证幂等，端口层可能再次调用），
/// 否则在既有路径上补该后缀。
pub fn build_chat_completions_url(base_url: &str) -> Result<reqwest::Url> {
    let trimmed = base_url.trim();
    if trimmed.is_empty() {
        return Err(anyhow::anyhow!("AI base url is empty"));
    }
    let mut url = parse_http_url(trimmed)?;
    let path = url.path().trim_end_matches('/').to_string();
    if path.ends_with(CHAT_COMPLETIONS_PATH) {
        return Ok(url);
    }
    url.set_path(&format!("{path}{CHAT_COMPLETIONS_PATH}"));
    Ok(url)
}

/// 构造模型列表 URL。
///
/// 规则：trim 首尾空白后先校验基础地址（必须是带 host 的 http/https）；
/// 路径带 `/chat/completions` 后缀时先剥离，已是 `/models` 结尾则原样使用（幂等），
/// 否则在既有路径上补 `/models`。
pub fn build_models_url(base_url: &str) -> Result<reqwest::Url> {
    let trimmed = base_url.trim();
    if trimmed.is_empty() {
        return Err(anyhow::anyhow!("AI base url is empty"));
    }
    let mut url = parse_http_url(trimmed)?;
    let path = url.path().trim_end_matches('/').to_string();
    let base = path
        .strip_suffix(CHAT_COMPLETIONS_PATH)
        .unwrap_or(&path)
        .trim_end_matches('/')
        .to_string();
    if base.is_empty() {
        url.set_path(MODELS_PATH);
    } else if base.ends_with(MODELS_PATH) {
        // 已是 /models：保持原样，避免叠加成 /models/models。
        url.set_path(&base);
    } else {
        url.set_path(&format!("{base}{MODELS_PATH}"));
    }
    Ok(url)
}

/// 解析并校验 http(s) URL。
///
/// 只允许 http/https：拒绝 `file:`/`data:` 等协议，避免把本地/内嵌资源当作 AI 上游。
fn parse_http_url(candidate: &str) -> Result<reqwest::Url> {
    let url = reqwest::Url::parse(candidate)
        .with_context(|| format!("AI base url is not a valid url: {candidate}"))?;
    match url.scheme() {
        "http" | "https" => {}
        other => return Err(anyhow::anyhow!("unsupported AI base url scheme: {other}")),
    }
    if url.host_str().unwrap_or_default().is_empty() {
        return Err(anyhow::anyhow!("AI base url has no host"));
    }
    Ok(url)
}

/// 归一化请求超时：默认 30s，夹取到 `[1000, 120000]`。
pub fn normalize_timeout_ms(raw: Option<u64>) -> u64 {
    raw.unwrap_or(DEFAULT_TIMEOUT_MS)
        .clamp(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)
}

/// 归一化温度：NaN/无穷视为未设置，其余夹取到 `[0.0, 2.0]`。
pub fn normalize_temperature(raw: Option<f64>) -> Option<f64> {
    let value = raw?;
    if !value.is_finite() {
        return None;
    }
    Some(value.clamp(MIN_TEMPERATURE, MAX_TEMPERATURE))
}

/// 解析 OpenAI 兼容聊天补全响应。
///
/// 兼容点：
/// - `choices[0].message.content` 可以是字符串，也可以是分片数组（拼接各分片 `text`）；
/// - `model` / `usage.prompt_tokens` / `usage.completion_tokens` 可选，
///   计数同时兼容 JSON 数字与字符串数字。
pub fn parse_chat_completion(body: &str) -> Result<AiChatOutcome> {
    let value: serde_json::Value =
        serde_json::from_str(body).context("AI chat response is not valid json")?;

    let choices = value
        .get("choices")
        .and_then(|choices| choices.as_array())
        .ok_or_else(|| anyhow::anyhow!("AI chat response is missing 'choices' array"))?;
    let first = choices
        .first()
        .ok_or_else(|| anyhow::anyhow!("AI chat response has an empty 'choices' array"))?;
    let content = first
        .get("message")
        .and_then(extract_message_content)
        .ok_or_else(|| {
            anyhow::anyhow!("AI chat response is missing 'choices[0].message.content'")
        })?;

    Ok(AiChatOutcome {
        content,
        model: value
            .get("model")
            .and_then(|model| model.as_str())
            .map(str::trim)
            .filter(|model| !model.is_empty())
            .map(str::to_string),
        prompt_tokens: number_at(&value, &["usage", "prompt_tokens"]),
        completion_tokens: number_at(&value, &["usage", "completion_tokens"]),
    })
}

/// 解析 OpenAI 兼容模型列表响应。
///
/// 兼容 `{"data":[{"id":...}]}`、顶层数组、以及 `{"models":[{"name":...}]}`；
/// 去重并保持出现顺序，跳过非字符串/空值。
pub fn parse_models_list(body: &str) -> Result<Vec<String>> {
    let value: serde_json::Value =
        serde_json::from_str(body).context("AI models response is not valid json")?;

    let entries = if let Some(array) = value.as_array() {
        array.as_slice()
    } else if let Some(array) = value.get("data").and_then(|data| data.as_array()) {
        array.as_slice()
    } else if let Some(array) = value.get("models").and_then(|models| models.as_array()) {
        array.as_slice()
    } else {
        return Err(anyhow::anyhow!(
            "AI models response has no 'data' or 'models' array"
        ));
    };

    let mut seen = std::collections::HashSet::new();
    let mut models = Vec::new();
    for entry in entries {
        let id = entry
            .get("id")
            .and_then(|id| id.as_str())
            .or_else(|| entry.get("name").and_then(|name| name.as_str()))
            .or_else(|| entry.as_str());
        let Some(id) = id else {
            continue;
        };
        let id = id.trim();
        if id.is_empty() {
            continue;
        }
        if seen.insert(id.to_string()) {
            models.push(id.to_string());
        }
    }
    Ok(models)
}

/// 提取上游错误文本：优先 `error.message`，其次 `message`，最后截断原始报文。
///
/// 最终结果按 Unicode 标量截断到 300 字符，任何输入都不会 panic。
pub fn extract_upstream_error(body: &str, status: u16) -> String {
    let trimmed = body.trim();
    let message = upstream_message(trimmed).unwrap_or_else(|| {
        if trimmed.is_empty() {
            format!("upstream returned status {status}")
        } else {
            trimmed.to_string()
        }
    });
    truncate_chars(&message, UPSTREAM_ERROR_MAX_CHARS)
}

/// 从错误报文中提取可读消息（非 JSON / 无候选字段时返回 None）。
fn upstream_message(body: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(body).ok()?;
    [
        value
            .get("error")
            .and_then(|error| error.get("message"))
            .and_then(|message| message.as_str()),
        value.get("error").and_then(|error| error.as_str()),
        value.get("message").and_then(|message| message.as_str()),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .find(|message| !message.is_empty())
    .map(str::to_string)
}

/// 按 Unicode 标量截断文本。
fn truncate_chars(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    text.chars().take(max_chars).collect()
}

/// 从 `message` 节点提取文本内容（字符串或分片数组）。
fn extract_message_content(message: &serde_json::Value) -> Option<String> {
    match message.get("content")? {
        serde_json::Value::String(text) => Some(text.clone()),
        serde_json::Value::Array(parts) => {
            let mut joined = String::new();
            for part in parts {
                if let Some(text) = part.get("text").and_then(|text| text.as_str()) {
                    joined.push_str(text);
                } else if let Some(text) = part.as_str() {
                    joined.push_str(text);
                }
            }
            Some(joined)
        }
        // 工具调用等场景会返回 null：按“无文本”处理，由调用方给出明确错误。
        _ => None,
    }
}

/// 按路径读取 JSON 数字（兼容字符串数字）。
fn number_at(value: &serde_json::Value, path: &[&str]) -> Option<u64> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    json_to_u64(current)
}

/// JSON 数字/字符串数字 -> u64（负数、NaN、超界一律返回 None）。
fn json_to_u64(value: &serde_json::Value) -> Option<u64> {
    match value {
        serde_json::Value::Number(number) => number.as_u64().or_else(|| {
            number
                .as_f64()
                .filter(|float| float.is_finite() && *float >= 0.0)
                .map(float_to_u64)
        }),
        // 部分兼容实现把计数返回为字符串（例如 "12"）。
        serde_json::Value::String(text) => {
            let trimmed = text.trim();
            trimmed.parse::<u64>().ok().or_else(|| {
                trimmed
                    .parse::<f64>()
                    .ok()
                    .filter(|float| float.is_finite() && *float >= 0.0)
                    .map(float_to_u64)
            })
        }
        _ => None,
    }
}

/// f64 -> u64（Rust 的 `as` 转换对越界值饱和，不会 panic）。
fn float_to_u64(value: f64) -> u64 {
    if value <= 0.0 {
        0
    } else if value >= u64::MAX as f64 {
        u64::MAX
    } else {
        value as u64
    }
}

/// 打码敏感值：把文本中出现的每一个非空密钥替换为 `***`。
///
/// 所有可能离开进程的错误文本都必须先经过本函数。
pub fn redact_secret(text: &str, secret: Option<&str>) -> String {
    let Some(secret) = secret else {
        return text.to_string();
    };
    if secret.is_empty() {
        return text.to_string();
    }
    text.replace(secret, "***")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(role: &str, content: &str) -> AiChatMessage {
        AiChatMessage {
            role: role.to_string(),
            content: content.to_string(),
        }
    }

    #[test]
    fn builds_chat_completions_url_variants() {
        let url = build_chat_completions_url("https://api.openai.com/v1").unwrap();
        assert_eq!(url.as_str(), "https://api.openai.com/v1/chat/completions");

        let url = build_chat_completions_url("https://api.openai.com/v1/").unwrap();
        assert_eq!(url.as_str(), "https://api.openai.com/v1/chat/completions");

        // 幂等：已是完整地址时原样使用。
        let url = build_chat_completions_url("https://api.openai.com/v1/chat/completions").unwrap();
        assert_eq!(url.as_str(), "https://api.openai.com/v1/chat/completions");

        let url = build_chat_completions_url("  http://localhost:11434/v1  ").unwrap();
        assert_eq!(url.as_str(), "http://localhost:11434/v1/chat/completions");
    }

    #[test]
    fn builds_chat_completions_url_rejects_invalid_input() {
        assert!(build_chat_completions_url("").is_err());
        assert!(build_chat_completions_url("   ").is_err());
        assert!(build_chat_completions_url("not-a-url").is_err());
        assert!(build_chat_completions_url("file:///etc/passwd").is_err());
        assert!(build_chat_completions_url("ftp://example.com/v1").is_err());
        assert!(build_chat_completions_url("https://").is_err());
    }

    #[test]
    fn builds_models_url_variants() {
        let url = build_models_url("https://api.openai.com/v1").unwrap();
        assert_eq!(url.as_str(), "https://api.openai.com/v1/models");

        let url = build_models_url("https://api.openai.com/v1/").unwrap();
        assert_eq!(url.as_str(), "https://api.openai.com/v1/models");

        // 剥离 chat completions 后缀。
        let url = build_models_url("https://api.openai.com/v1/chat/completions").unwrap();
        assert_eq!(url.as_str(), "https://api.openai.com/v1/models");

        // 幂等：已是 /models 时不再叠加。
        let url = build_models_url("https://api.openai.com/v1/models").unwrap();
        assert_eq!(url.as_str(), "https://api.openai.com/v1/models");
    }

    #[test]
    fn builds_models_url_rejects_invalid_input() {
        assert!(build_models_url("").is_err());
        assert!(build_models_url("data:text/plain,hello").is_err());
        assert!(build_models_url("https://").is_err());
    }

    #[test]
    fn normalizes_timeout() {
        assert_eq!(normalize_timeout_ms(None), 30_000);
        assert_eq!(normalize_timeout_ms(Some(0)), 1_000);
        assert_eq!(normalize_timeout_ms(Some(999)), 1_000);
        assert_eq!(normalize_timeout_ms(Some(1_000)), 1_000);
        assert_eq!(normalize_timeout_ms(Some(45_000)), 45_000);
        assert_eq!(normalize_timeout_ms(Some(120_000)), 120_000);
        assert_eq!(normalize_timeout_ms(Some(120_001)), 120_000);
        assert_eq!(normalize_timeout_ms(Some(u64::MAX)), 120_000);
    }

    #[test]
    fn normalizes_temperature() {
        assert_eq!(normalize_temperature(None), None);
        assert_eq!(normalize_temperature(Some(f64::NAN)), None);
        assert_eq!(normalize_temperature(Some(f64::INFINITY)), None);
        assert_eq!(normalize_temperature(Some(f64::NEG_INFINITY)), None);
        assert_eq!(normalize_temperature(Some(-1.0)), Some(0.0));
        assert_eq!(normalize_temperature(Some(0.0)), Some(0.0));
        assert_eq!(normalize_temperature(Some(0.7)), Some(0.7));
        assert_eq!(normalize_temperature(Some(2.0)), Some(2.0));
        assert_eq!(normalize_temperature(Some(9.9)), Some(2.0));
    }

    #[test]
    fn parses_chat_completion_with_string_content() {
        let body = r#"{
            "model": "gpt-4o-mini",
            "choices": [{ "message": { "role": "assistant", "content": "hello" } }],
            "usage": { "prompt_tokens": 11, "completion_tokens": 7 }
        }"#;
        let outcome = parse_chat_completion(body).unwrap();
        assert_eq!(outcome.content, "hello");
        assert_eq!(outcome.model.as_deref(), Some("gpt-4o-mini"));
        assert_eq!(outcome.prompt_tokens, Some(11));
        assert_eq!(outcome.completion_tokens, Some(7));
    }

    #[test]
    fn parses_chat_completion_with_string_numbers_and_float_usage() {
        let body = r#"{
            "choices": [{ "message": { "content": "ok" } }],
            "usage": { "prompt_tokens": "12", "completion_tokens": 3.0 }
        }"#;
        let outcome = parse_chat_completion(body).unwrap();
        assert_eq!(outcome.content, "ok");
        assert_eq!(outcome.prompt_tokens, Some(12));
        assert_eq!(outcome.completion_tokens, Some(3));
    }

    #[test]
    fn parses_chat_completion_with_array_content() {
        let body = r#"{
            "choices": [{ "message": { "content": [
                { "type": "text", "text": "hello " },
                { "type": "text", "text": "world" },
                { "type": "image_url", "image_url": { "url": "https://x/y.png" } }
            ] } }]
        }"#;
        let outcome = parse_chat_completion(body).unwrap();
        assert_eq!(outcome.content, "hello world");
        assert_eq!(outcome.model, None);
        assert_eq!(outcome.prompt_tokens, None);
    }

    #[test]
    fn parses_chat_completion_without_optional_fields() {
        let body = r#"{ "choices": [{ "message": { "content": "" } }] }"#;
        let outcome = parse_chat_completion(body).unwrap();
        assert_eq!(outcome.content, "");
        assert_eq!(outcome.model, None);
        assert_eq!(outcome.prompt_tokens, None);
        assert_eq!(outcome.completion_tokens, None);
    }

    #[test]
    fn rejects_malformed_chat_completions() {
        for body in [
            "",
            "not json",
            "{}",
            r#"{ "choices": [] }"#,
            r#"{ "choices": [{}] }"#,
            r#"{ "choices": [{ "message": {} }] }"#,
            r#"{ "choices": [{ "message": { "content": null } }] }"#,
            r#"{ "choices": [{ "message": { "content": 42 } }] }"#,
            r#"{ "choices": "nope" }"#,
        ] {
            assert!(
                parse_chat_completion(body).is_err(),
                "expected parse error for {body:?}"
            );
        }
    }

    #[test]
    fn parses_models_list_variants() {
        let body = r#"{ "object": "list", "data": [ { "id": "a" }, { "id": "b" } ] }"#;
        assert_eq!(parse_models_list(body).unwrap(), vec!["a", "b"]);

        // 顶层裸数组。
        assert_eq!(parse_models_list(r#"["a", "b"]"#).unwrap(), vec!["a", "b"]);

        // models[].name 兜底。
        assert_eq!(
            parse_models_list(r#"{ "models": [ { "name": "m1" } ] }"#).unwrap(),
            vec!["m1"]
        );

        // 空列表是合法响应。
        assert!(parse_models_list(r#"{ "data": [] }"#).unwrap().is_empty());
    }

    #[test]
    fn parses_models_list_dedupes_and_skips_invalid() {
        let body = r#"{ "data": [
            { "id": "a" },
            { "id": "b" },
            { "id": "a" },
            { "id": "" },
            { "id": 7 },
            { "name": "c" },
            { "id": "  d  " },
            {}
        ] }"#;
        assert_eq!(
            parse_models_list(body).unwrap(),
            vec!["a", "b", "c", "d"],
            "应去重、保持顺序、跳过非字符串与空值"
        );
    }

    #[test]
    fn rejects_malformed_models_list() {
        for body in ["", "nope", "{}", r#"{ "data": {} }"#, r#"{ "data": 1 }"#] {
            assert!(
                parse_models_list(body).is_err(),
                "expected parse error for {body:?}"
            );
        }
    }

    #[test]
    fn extracts_upstream_error_messages() {
        assert_eq!(
            extract_upstream_error(r#"{ "error": { "message": "bad key" } }"#, 401),
            "bad key"
        );
        assert_eq!(
            extract_upstream_error(r#"{ "message": "oops" }"#, 500),
            "oops"
        );
        assert_eq!(
            extract_upstream_error(r#"{ "error": "plain error" }"#, 400),
            "plain error"
        );
        // 空报文回落到状态码。
        assert_eq!(
            extract_upstream_error("   ", 503),
            "upstream returned status 503"
        );
        // 非 JSON 原文按原样返回。
        assert_eq!(
            extract_upstream_error("gateway timeout", 504),
            "gateway timeout"
        );
        // 空消息体（错误字段为空串）回落到原始报文。
        assert_eq!(
            extract_upstream_error(r#"{ "error": { "message": "" } }"#, 400),
            r#"{ "error": { "message": "" } }"#
        );
    }

    #[test]
    fn truncates_upstream_error_safely() {
        let long = "a".repeat(400);
        let truncated = extract_upstream_error(&long, 500);
        assert_eq!(truncated.chars().count(), 300);

        // 多字节字符必须按字符边界截断（不得 panic、不得产生非法 UTF-8）。
        let wide = "中".repeat(400);
        let truncated = extract_upstream_error(&wide, 500);
        assert_eq!(truncated.chars().count(), 300);

        // 恰好 300 字符不截断。
        let exact = "b".repeat(300);
        assert_eq!(extract_upstream_error(&exact, 500), exact);
    }

    #[test]
    fn redacts_secret_occurrences() {
        assert_eq!(
            redact_secret("failed with sk-abc and sk-abc", Some("sk-abc")),
            "failed with *** and ***"
        );
        assert_eq!(redact_secret("no secret here", None), "no secret here");
        assert_eq!(redact_secret("text", Some("")), "text");
        assert_eq!(redact_secret("Bearer sk-1", Some("sk-1")), "Bearer ***");
    }

    #[test]
    fn validation_error_codes_are_stable() {
        assert_eq!(
            AiValidationError::InvalidProviderId("x".into()).code(),
            "AI_INVALID_PROVIDER_ID"
        );
        assert_eq!(
            AiValidationError::InvalidBaseUrl("x".into()).i18n_key(),
            "error.ai_invalid_base_url"
        );
        assert_eq!(
            AiValidationError::InvalidRequest("x".into()).code(),
            "AI_INVALID_REQUEST"
        );
    }

    #[test]
    fn chat_message_serializes_for_upstream_body() {
        let value = serde_json::to_value(vec![message("user", "hi")]).unwrap();
        assert_eq!(value[0]["role"], "user");
        assert_eq!(value[0]["content"], "hi");
    }
}
