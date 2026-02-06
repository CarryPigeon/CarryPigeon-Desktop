//! plugin_store｜受控网络访问（同源 fetch）。
//!
//! 说明：
//! - 插件运行时可能需要发起 HTTP 请求（例如访问服务端扩展 API）；
//! - 为避免把客户端变成开放代理，这里强制“同源限制”：只能访问当前 server origin；
//! - TLS 策略（自签/指纹）与服务端一致，以保证在受控环境下可用。

use anyhow::Context;
use serde::Serialize;

use super::{download::is_same_origin, origin::to_http_origin, tls::build_server_client};

/// 插件侧受控网络请求的返回封包。
///
/// # 说明
/// - 该结构会序列化返回给前端（Tauri command），用于插件 runtime 的 `network.fetch()` API。
/// - `body_text` 为响应体文本（best-effort）；二进制内容可由上层按需约定编码。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginFetchResponse {
    /// 是否为 2xx 成功响应。
    pub ok: bool,
    /// HTTP 状态码。
    pub status: u16,
    /// 响应体文本（best-effort）。
    pub body_text: String,
    /// 响应头（已转换为字符串）。
    pub headers: std::collections::HashMap<String, String>,
}

/// 以“同源限制”发起受控 HTTP 请求。
///
/// # 参数
/// - `server_socket`：服务器 socket 地址（用于推导同源 origin）。
/// - `url`：目标 URL（允许以 `/path` 形式传入，会自动拼接到 `origin`）。
/// - `method`：HTTP method（例如 `GET` / `POST`）。
/// - `headers`：请求头映射表。
/// - `body`：请求体（可选，文本）。
/// - `tls_policy`：TLS 策略（可选，取值与前端一致）。
/// - `tls_fingerprint`：TLS 指纹（可选，SHA-256 hex）。
///
/// # 返回值
/// - 成功时返回 `PluginFetchResponse`。
///
/// # 说明
/// - 该函数会拒绝跨域访问，避免插件把客户端当作开放代理使用。
pub async fn network_fetch(
    server_socket: &str,
    url: &str,
    method: &str,
    headers: std::collections::HashMap<String, String>,
    body: Option<String>,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<PluginFetchResponse> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let base = reqwest::Url::parse(&origin).context("Invalid server origin")?;

    let raw_url = url.trim();
    if raw_url.is_empty() {
        return Err(anyhow::anyhow!("Missing url"));
    }
    let full = if raw_url.starts_with('/') {
        format!("{}{}", origin.trim_end_matches('/'), raw_url)
    } else {
        raw_url.to_string()
    };
    let target = reqwest::Url::parse(&full).context("Invalid url")?;

    if !is_same_origin(&target, &base) {
        return Err(anyhow::anyhow!("Network access denied: cross-origin"));
    }

    let m = reqwest::Method::from_bytes(method.trim().to_uppercase().as_bytes())
        .context("Invalid method")?;
    let mut req = client.request(m, target);
    for (k, v) in headers {
        if k.trim().is_empty() {
            continue;
        }
        req = req.header(k, v);
    }
    if let Some(b) = body {
        req = req.body(b);
    }
    let res = req.send().await.context("Request failed")?;
    let status = res.status();
    let mut out_headers = std::collections::HashMap::new();
    for (k, v) in res.headers().iter() {
        if let Ok(s) = v.to_str() {
            out_headers.insert(k.to_string(), s.to_string());
        }
    }
    let body_text = res.text().await.unwrap_or_default();
    Ok(PluginFetchResponse {
        ok: status.is_success(),
        status: status.as_u16(),
        body_text,
        headers: out_headers,
    })
}
