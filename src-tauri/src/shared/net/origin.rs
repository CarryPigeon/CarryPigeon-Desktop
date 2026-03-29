//! shared｜server socket → HTTP origin 映射。
//!
//! 说明：
//! - 前端允许使用 `ws://` / `wss://` / `tcp://` / `tls://` / `tls-insecure://` / `tls-fp://` 等协议前缀；
//! - 原生侧请求 `docs/api/*` 对应的 HTTP API 时，需要把这些 socket 统一映射为 `http(s)://host:port`。
//!
//! 约定：注释中文，日志英文（tracing）。

use anyhow::Context;

/// 将 URL 端口格式化为 `:port`；若不存在端口则返回空字符串。
pub(crate) fn port_suffix(u: &reqwest::Url) -> String {
    u.port().map(|p| format!(":{}", p)).unwrap_or_default()
}

/// 将 socket 输入映射为可解析的 URL 字符串（尚未归一化 host/port）。
fn map_socket_to_url_candidate(raw: &str) -> String {
    if let Some(rest) = raw.strip_prefix("ws://") {
        return format!("http://{}", rest);
    }
    if let Some(rest) = raw.strip_prefix("wss://") {
        return format!("https://{}", rest);
    }
    if let Some(rest) = raw.strip_prefix("tcp://") {
        return format!("http://{}", rest);
    }
    if let Some(rest) = raw.strip_prefix("tls://") {
        return format!("https://{}", rest);
    }
    if let Some(rest) = raw.strip_prefix("tls-insecure://") {
        return format!("https://{}", rest);
    }
    if let Some(rest) = raw.strip_prefix("tls-fp://") {
        // `tls-fp://{fp}@host:port` -> `https://host:port`
        let addr = rest.split_once('@').map(|x| x.1).unwrap_or(rest);
        return format!("https://{}", addr);
    }
    if raw.starts_with("http://") || raw.starts_with("https://") {
        return raw.to_string();
    }
    format!("https://{}", raw)
}

/// 将已解析 URL 归一化为 `scheme://host[:port]`。
fn normalize_origin(url: &reqwest::Url) -> String {
    format!(
        "{}://{}{}",
        url.scheme(),
        url.host_str().unwrap_or_default(),
        port_suffix(url)
    )
}

/// 将 server socket 映射为 HTTP origin（`http(s)://host:port`）。
///
/// 说明：
/// - `tls-fp://{fp}@host:port` 会丢弃 `{fp}@` 前缀，仅保留 `host:port`。
pub(crate) fn to_http_origin(server_socket: &str) -> anyhow::Result<String> {
    let raw = server_socket.trim();
    if raw.is_empty() {
        return Err(anyhow::anyhow!("Missing server socket"));
    }

    let mapped = map_socket_to_url_candidate(raw);

    let u = reqwest::Url::parse(&mapped).context("Invalid server socket URL")?;
    Ok(normalize_origin(&u))
}
