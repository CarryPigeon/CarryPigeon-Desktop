//! network｜DI 边界模型：models。
//!
//! 约定：注释中文，日志英文（tracing）。

/// `/api/*` JSON 请求参数（前端 -> Rust 命令边界）。
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRequestJsonArgs {
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

/// `/api/*` JSON 请求结果（Rust 命令边界 -> 前端）。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRequestJsonResult {
    /// 是否为 2xx 成功响应。
    pub ok: bool,
    /// HTTP 状态码。
    pub status: u16,
    /// 成功响应体（JSON）。
    pub body: Option<serde_json::Value>,
    /// 错误响应体（JSON）。
    pub error: Option<serde_json::Value>,
}
