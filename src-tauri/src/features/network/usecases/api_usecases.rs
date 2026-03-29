//! network｜用例层：api_usecases。
//!
//! 约定：注释中文，日志英文（tracing）。

use crate::features::network::domain::ports::api_request_port::{
    ApiHttpRequest, ApiHttpResponse, ApiHttpTlsPolicy, ApiRequestPort,
};
use crate::shared::net::origin::to_http_origin;

/// `/api/*` JSON 请求参数（前端 -> Rust）。
///
/// # 说明
/// - 该结构属于网络请求用例模型；
/// - 仅允许请求 `/api/*` 路径（由用例层校验）。
#[derive(Debug, Clone)]
pub struct ApiJsonRequest {
    /// 服务器 socket 地址（用于 TLS 策略与网络命名空间）。
    pub server_socket: String,
    /// HTTP method（例如 `GET` / `POST`）。
    pub method: String,
    /// API 路径（必须以 `/api/` 开头）。
    pub path: String,
    /// 请求头（可选）。
    pub headers: Option<std::collections::BTreeMap<String, String>>,
    /// JSON 请求体（可选）。
    pub body: Option<serde_json::Value>,
    /// TLS 策略（可选）。
    pub tls_policy: Option<String>,
    /// TLS 指纹（可选，SHA-256 hex）。
    pub tls_fingerprint: Option<String>,
}

/// `/api/*` JSON 请求结果（Rust -> 前端）。
#[derive(Debug, Clone)]
pub struct ApiJsonResponse {
    /// 是否为 2xx 成功响应。
    pub ok: bool,
    /// HTTP 状态码。
    pub status: u16,
    /// 成功响应体（JSON）。
    pub body: Option<serde_json::Value>,
    /// 错误响应体（JSON）。
    pub error: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TlsPolicy {
    Strict,
    Insecure,
    TrustFingerprint,
}

fn parse_tls_policy(raw: Option<&str>) -> TlsPolicy {
    match raw.unwrap_or("strict").trim() {
        "insecure" => TlsPolicy::Insecure,
        "trust_fingerprint" => TlsPolicy::TrustFingerprint,
        _ => TlsPolicy::Strict,
    }
}

fn map_tls_policy(policy: TlsPolicy) -> ApiHttpTlsPolicy {
    match policy {
        TlsPolicy::Strict => ApiHttpTlsPolicy::Strict,
        TlsPolicy::Insecure => ApiHttpTlsPolicy::Insecure,
        TlsPolicy::TrustFingerprint => ApiHttpTlsPolicy::TrustFingerprint,
    }
}

fn normalize_server_socket(raw: &str) -> anyhow::Result<String> {
    let socket = raw.trim().to_string();
    if socket.is_empty() {
        return Err(anyhow::anyhow!("Missing server_socket"));
    }
    Ok(socket)
}

fn normalize_method(raw: &str) -> anyhow::Result<String> {
    let method = raw.trim().to_uppercase();
    if method.is_empty() {
        return Err(anyhow::anyhow!("Missing method"));
    }
    Ok(method)
}

fn normalize_api_path(raw: &str) -> anyhow::Result<String> {
    let path = raw.trim().to_string();
    if !path.starts_with("/api/") {
        return Err(anyhow::anyhow!("Invalid path: must start with /api/"));
    }
    if path.contains("..") {
        return Err(anyhow::anyhow!("Invalid path: contains '..'"));
    }
    Ok(path)
}

fn to_api_json_response(response: ApiHttpResponse) -> ApiJsonResponse {
    if response.ok {
        return ApiJsonResponse {
            ok: true,
            status: response.status,
            body: response.body,
            error: None,
        };
    }
    ApiJsonResponse {
        ok: false,
        status: response.status,
        body: None,
        error: response.body,
    }
}

/// 执行 `/api/*` JSON 请求（Rust -> server），并返回结构化结果供前端使用。
///
/// # 参数
/// - `args`：请求参数（server_socket/method/path/headers/body/tls_*）。
/// - `api_request_port`：API 请求端口（由 DI 注入）。
///
/// # 返回值
/// - `Ok(ApiJsonResponse)`：请求结果（ok/status/body/error）。
/// - `Err(anyhow::Error)`：请求失败原因（参数校验/TLS 校验/网络错误等）。
///
/// # 说明
/// - 仅允许请求 `/api/*` 路径，并做基础的 `..` 防穿越校验；
/// - 当 TLS 策略为指纹信任时，会在请求前先校验证书指纹；
/// - 204 No Content 会返回空 body/error。
pub async fn api_request_json(
    args: ApiJsonRequest,
    api_request_port: &dyn ApiRequestPort,
) -> anyhow::Result<ApiJsonResponse> {
    let ApiJsonRequest {
        server_socket,
        method,
        path,
        headers,
        body,
        tls_policy,
        tls_fingerprint,
    } = args;

    let socket = normalize_server_socket(&server_socket)?;
    let method = normalize_method(&method)?;
    let path = normalize_api_path(&path)?;

    let origin = to_http_origin(&socket)?;
    let url = format!("{}{}", origin, path);
    let response = api_request_port
        .execute_json_request(ApiHttpRequest {
            method,
            url,
            headers: headers.unwrap_or_default(),
            body,
            tls_policy: map_tls_policy(parse_tls_policy(tls_policy.as_deref())),
            tls_fingerprint,
        })
        .await?;
    Ok(to_api_json_response(response))
}
