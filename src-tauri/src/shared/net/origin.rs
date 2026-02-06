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
    match u.port() {
        Some(p) => format!(":{}", p),
        None => "".to_string(),
    }
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

    let mapped = if let Some(rest) = raw.strip_prefix("ws://") {
        format!("http://{}", rest)
    } else if let Some(rest) = raw.strip_prefix("wss://") {
        format!("https://{}", rest)
    } else if let Some(rest) = raw.strip_prefix("tcp://") {
        format!("http://{}", rest)
    } else if let Some(rest) = raw.strip_prefix("tls://") {
        format!("https://{}", rest)
    } else if let Some(rest) = raw.strip_prefix("tls-insecure://") {
        format!("https://{}", rest)
    } else if let Some(rest) = raw.strip_prefix("tls-fp://") {
        // `tls-fp://{fp}@host:port`
        let addr = rest.split_once('@').map(|x| x.1).unwrap_or(rest);
        format!("https://{}", addr)
    } else if raw.starts_with("http://") || raw.starts_with("https://") {
        raw.to_string()
    } else {
        format!("https://{}", raw)
    };

    let u = reqwest::Url::parse(&mapped).context("Invalid server socket URL")?;
    Ok(format!(
        "{}://{}{}",
        u.scheme(),
        u.host_str().unwrap_or_default(),
        port_suffix(&u)
    ))
}
