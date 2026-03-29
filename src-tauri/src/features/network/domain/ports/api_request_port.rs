//! network｜领域端口：api_request_port。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::collections::BTreeMap;
use std::future::Future;
use std::pin::Pin;

/// API HTTP TLS 策略。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApiHttpTlsPolicy {
    Strict,
    Insecure,
    TrustFingerprint,
}

/// API JSON 请求参数（用例 -> 端口）。
#[derive(Debug, Clone)]
pub struct ApiHttpRequest {
    pub method: String,
    pub url: String,
    pub headers: BTreeMap<String, String>,
    pub body: Option<serde_json::Value>,
    pub tls_policy: ApiHttpTlsPolicy,
    pub tls_fingerprint: Option<String>,
}

/// API JSON 请求结果（端口 -> 用例）。
#[derive(Debug, Clone)]
pub struct ApiHttpResponse {
    pub ok: bool,
    pub status: u16,
    pub body: Option<serde_json::Value>,
}

/// API 请求端口 Future 类型。
pub type ApiHttpRequestFuture<'a> =
    Pin<Box<dyn Future<Output = anyhow::Result<ApiHttpResponse>> + Send + 'a>>;

/// API 请求端口（由数据层适配器实现）。
pub trait ApiRequestPort: Send + Sync {
    /// 执行 JSON API 请求。
    fn execute_json_request<'a>(&'a self, request: ApiHttpRequest) -> ApiHttpRequestFuture<'a>;
}
