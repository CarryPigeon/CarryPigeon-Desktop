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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn port_suffix_with_port() {
        let u = reqwest::Url::parse("http://example.com:8080/path").unwrap();
        assert_eq!(port_suffix(&u), ":8080");
    }

    #[test]
    fn port_suffix_default_http() {
        let u = reqwest::Url::parse("http://example.com/path").unwrap();
        assert_eq!(port_suffix(&u), "");
    }

    #[test]
    fn port_suffix_default_https() {
        let u = reqwest::Url::parse("https://example.com/path").unwrap();
        assert_eq!(port_suffix(&u), "");
    }

    #[test]
    fn map_ws_to_http() {
        assert_eq!(
            map_socket_to_url_candidate("ws://host:1234"),
            "http://host:1234"
        );
    }

    #[test]
    fn map_wss_to_https() {
        assert_eq!(
            map_socket_to_url_candidate("wss://host:1234"),
            "https://host:1234"
        );
    }

    #[test]
    fn map_tcp_to_http() {
        assert_eq!(
            map_socket_to_url_candidate("tcp://host:8080"),
            "http://host:8080"
        );
    }

    #[test]
    fn map_tls_to_https() {
        assert_eq!(
            map_socket_to_url_candidate("tls://host:8443"),
            "https://host:8443"
        );
    }

    #[test]
    fn map_tls_insecure_to_https() {
        assert_eq!(
            map_socket_to_url_candidate("tls-insecure://host:8443"),
            "https://host:8443"
        );
    }

    #[test]
    fn map_tls_fp_strips_fingerprint() {
        assert_eq!(
            map_socket_to_url_candidate("tls-fp://abc123@host:8443"),
            "https://host:8443"
        );
    }

    #[test]
    fn map_tls_fp_no_at_keeps_rest() {
        assert_eq!(
            map_socket_to_url_candidate("tls-fp://host:8443"),
            "https://host:8443"
        );
    }

    #[test]
    fn map_http_passthrough() {
        assert_eq!(
            map_socket_to_url_candidate("http://example.com"),
            "http://example.com"
        );
    }

    #[test]
    fn map_https_passthrough() {
        assert_eq!(
            map_socket_to_url_candidate("https://example.com"),
            "https://example.com"
        );
    }

    #[test]
    fn map_bare_host_defaults_to_https() {
        assert_eq!(
            map_socket_to_url_candidate("example.com:443"),
            "https://example.com:443"
        );
    }

    #[test]
    fn to_http_origin_ws() {
        let origin = to_http_origin("ws://example.com:8080/extra").unwrap();
        assert_eq!(origin, "http://example.com:8080");
    }

    #[test]
    fn to_http_origin_tls_fp() {
        let origin = to_http_origin("tls-fp://deadbeef@example.com:8443").unwrap();
        assert_eq!(origin, "https://example.com:8443");
    }

    #[test]
    fn to_http_origin_empty_rejected() {
        let err = to_http_origin("").unwrap_err();
        assert!(err.to_string().contains("Missing server socket"));
    }

    #[test]
    fn to_http_origin_garbage_rejected() {
        let err = to_http_origin("not a url!!").unwrap_err();
        assert!(err.to_string().contains("Invalid server socket URL"));
    }

    #[test]
    fn normalize_origin_strips_path() {
        let u = reqwest::Url::parse("https://example.com:8443/some/path?q=1").unwrap();
        assert_eq!(normalize_origin(&u), "https://example.com:8443");
    }

    #[test]
    fn normalize_origin_default_port() {
        let u = reqwest::Url::parse("https://example.com/foo").unwrap();
        assert_eq!(normalize_origin(&u), "https://example.com");
    }
}
