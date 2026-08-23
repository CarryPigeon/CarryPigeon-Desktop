//! network｜链接预览抓取。
//!
//! 通过 HTTP GET 获取目标网页，提取 title、description、Open Graph 标签。
//! 安全约束：
//! - 仅允许 http(s) 协议；
//! - 目标 host 解析出的 IP 不得位于回环/私网/链路本地等保留段（防 SSRF）；
//! - 不跟随重定向；
//! - 响应体流式读取，硬上限 512KB（超限即停止拉取）。

use std::net::{IpAddr, SocketAddr};

use serde::Serialize;

use crate::shared::error::{CommandResult, to_command_error};

#[derive(Debug, Clone, Serialize)]
pub struct LinkPreviewDto {
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub favicon_url: Option<String>,
    pub site_name: Option<String>,
}

/// 判断 IP 是否属于禁止抓取的地址段（回环/私网/链路本地/未指定/ULA 等）。
fn is_disallowed_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_unspecified()
                || v4.is_broadcast()
        }
        IpAddr::V6(v6) => {
            // IPv4-mapped IPv6（::ffff:a.b.c.d）按 IPv4 规则判断。
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_disallowed_ip(IpAddr::V4(v4));
            }
            v6.is_loopback()
                || v6.is_unspecified()
                || (v6.segments()[0] & 0xfe00) == 0xfc00 // ULA fc00::/7
                || (v6.segments()[0] & 0xffc0) == 0xfe80 // link-local fe80::/10
        }
    }
}

/// 校验抓取目标：仅允许 http(s)，host 非空；返回归一化的 host:port 供 DNS 解析。
fn validate_preview_target(raw_url: &str) -> Result<(reqwest::Url, String), String> {
    let parsed = reqwest::Url::parse(raw_url.trim())
        .map_err(|e| format!("[LINK_PREVIEW_URL_INVALID] invalid url: {e}"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(format!(
            "[LINK_PREVIEW_SCHEME_REJECTED] scheme must be http(s), got: {}",
            parsed.scheme()
        ));
    }
    let host = parsed.host_str().unwrap_or_default().trim().to_string();
    if host.is_empty() {
        return Err("[LINK_PREVIEW_URL_INVALID] missing host".to_string());
    }
    let port = parsed.port_or_known_default().unwrap_or(80);
    Ok((parsed, format!("{host}:{port}")))
}

/// 解析目标 host，并确保全部解析结果均为可公网访问的地址（防内网探测）。
async fn ensure_public_host(host_port: &str) -> Result<Vec<SocketAddr>, String> {
    let addrs: Vec<SocketAddr> = tokio::net::lookup_host(host_port)
        .await
        .map_err(|e| format!("[LINK_PREVIEW_HOST_RESOLVE_FAILED] dns resolution failed: {e}"))?
        .collect();
    if addrs.is_empty() {
        return Err(
            "[LINK_PREVIEW_HOST_RESOLVE_FAILED] host resolved to no addresses".to_string(),
        );
    }
    for addr in &addrs {
        if is_disallowed_ip(addr.ip()) {
            return Err(format!(
                "[LINK_PREVIEW_TARGET_FORBIDDEN] target address {} is not allowed",
                addr.ip()
            ));
        }
    }
    Ok(addrs)
}

/// 响应体硬上限：512KB。
const MAX_PREVIEW_BYTES: usize = 512 * 1024;

/// 从 HTML 文本提取 meta 标签内容。
fn extract_meta(html: &str, name: &str) -> Option<String> {
    // Try <meta name="..." content="...">
    let pattern = format!(
        r#"<meta\s+[^>]*name\s*=\s*["']{}["'][^>]*content\s*=\s*["']([^"']*)["']"#,
        name
    );
    if let Some(cap) = regex_match(&pattern, html) {
        return Some(cap);
    }
    // Try <meta property="og:..." content="...">
    let og_pattern = format!(
        r#"<meta\s+[^>]*property\s*=\s*["']og:{}["'][^>]*content\s*=\s*["']([^"']*)["']"#,
        name
    );
    if let Some(cap) = regex_match(&og_pattern, html) {
        return Some(cap);
    }
    None
}

fn regex_match(pattern: &str, haystack: &str) -> Option<String> {
    let re = regex::Regex::new(pattern).ok()?;
    re.captures(haystack)
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
}

fn extract_title(html: &str) -> Option<String> {
    // Try og:title first, then <title>
    extract_meta(html, "title").or_else(|| {
        let re = regex::Regex::new(r"<title[^>]*>([^<]*)</title>").ok()?;
        re.captures(html)
            .and_then(|caps| caps.get(1))
            .map(|m| m.as_str().trim().to_string())
    })
}

fn extract_favicon(html: &str, base_url: &str) -> Option<String> {
    let patterns = [
        r#"<link\s+[^>]*rel\s*=\s*["'](?:shortcut\s+)?icon["'][^>]*href\s*=\s*["']([^"']*)["']"#,
        r#"<link\s+[^>]*href\s*=\s*["']([^"']*)["'][^>]*rel\s*=\s*["'](?:shortcut\s+)?icon["']"#,
    ];
    for p in &patterns {
        if let Some(href) = regex_match(p, html) {
            return Some(resolve_url(base_url, &href));
        }
    }
    None
}

fn resolve_url(base: &str, href: &str) -> String {
    if href.starts_with("http://") || href.starts_with("https://") {
        href.to_string()
    } else if href.starts_with("//") {
        format!("https:{}", href)
    } else if href.starts_with('/') {
        let base = base.trim_end_matches('/');
        format!("{}{}", base, href)
    } else {
        format!("{}/{}", base.trim_end_matches('/'), href)
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    // Safe truncation respecting UTF-8 char boundaries to avoid panics
    let mut byte_len = 0usize;
    for (i, c) in s.char_indices() {
        let c_len = c.len_utf8();
        if byte_len + c_len > max {
            return format!("{}…", &s[..i]);
        }
        byte_len += c_len;
    }
    s.to_string()
}

/// 获取链接预览信息。
#[tauri::command]
pub async fn fetch_link_preview(url: String) -> CommandResult<LinkPreviewDto> {
    // 安全校验：scheme 白名单 + 目标 IP 不得位于内网/保留段。
    let (_parsed, host_port) = validate_preview_target(&url)?;
    ensure_public_host(&host_port).await?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .user_agent("Mozilla/5.0 (compatible; CarryPigeon/1.0)")
        // 不跟随重定向：防止公网入口借 302 把抓取引回内网（SSRF 绕过）。
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| {
            to_command_error(
                "LINK_PREVIEW_CLIENT_BUILD_FAILED",
                "error.link_preview_client_build_failed",
                e,
            )
        })?;

    let resp = client.get(&url).send().await.map_err(|e| {
        to_command_error(
            "LINK_PREVIEW_FETCH_FAILED",
            "error.link_preview_fetch_failed",
            e,
        )
    })?;

    let status = resp.status();
    if !status.is_success() {
        tracing::warn!(
            action = "network_link_preview_non_success_status",
            url = %url,
            status = %status,
        );
        return Ok(LinkPreviewDto {
            url,
            title: None,
            description: None,
            image_url: None,
            favicon_url: None,
            site_name: None,
        });
    }

    // 流式读取响应体，达到硬上限即停止拉取（真实生效的 512KB 截断）。
    use futures_util::StreamExt;
    let mut body: Vec<u8> = Vec::with_capacity(64 * 1024);
    let mut truncated = false;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| {
            to_command_error(
                "LINK_PREVIEW_READ_BODY_FAILED",
                "error.link_preview_read_body_failed",
                e,
            )
        })?;
        if body.len() >= MAX_PREVIEW_BYTES
            || body.len() + chunk.len() > MAX_PREVIEW_BYTES
        {
            truncated = true;
            break;
        }
        body.extend_from_slice(&chunk);
    }
    if truncated {
        tracing::debug!(
            action = "network_link_preview_body_truncated",
            url = %url,
            limit_bytes = MAX_PREVIEW_BYTES,
        );
    }
    let html = String::from_utf8_lossy(&body);

    let title = extract_title(&html).map(|s| truncate(&s, 200));
    let description = extract_meta(&html, "description").map(|s| truncate(&s, 500));
    let image_url = extract_meta(&html, "image");
    let site_name = extract_meta(&html, "site_name");
    let favicon_url = extract_favicon(&html, &url);

    tracing::info!(
        action = "network_link_preview_fetched",
        url = %url,
        has_title = title.is_some(),
        has_description = description.is_some(),
        has_image = image_url.is_some(),
    );

    Ok(LinkPreviewDto {
        url,
        title,
        description,
        image_url,
        favicon_url,
        site_name,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_absolute_url() {
        assert_eq!(
            resolve_url("https://example.com", "https://other.com/img.png"),
            "https://other.com/img.png"
        );
    }

    #[test]
    fn resolve_protocol_relative() {
        assert_eq!(
            resolve_url("https://example.com", "//cdn.example.com/img.png"),
            "https://cdn.example.com/img.png"
        );
    }

    #[test]
    fn resolve_root_relative() {
        assert_eq!(
            resolve_url("https://example.com/page", "/img.png"),
            "https://example.com/page/img.png"
        );
    }

    #[test]
    fn resolve_relative() {
        assert_eq!(
            resolve_url("https://example.com/page/", "img.png"),
            "https://example.com/page/img.png"
        );
    }

    #[test]
    fn resolve_relative_no_trailing_slash() {
        assert_eq!(
            resolve_url("https://example.com/page", "img.png"),
            "https://example.com/page/img.png"
        );
    }

    #[test]
    fn truncate_no_op() {
        assert_eq!(truncate("hello", 10), "hello");
    }

    #[test]
    fn truncate_exact_length() {
        assert_eq!(truncate("hello", 5), "hello");
    }

    #[test]
    fn truncate_with_ellipsis() {
        let result = truncate("hello world", 5);
        assert!(result.ends_with('…'));
        assert!(result.len() <= 5 + 3); // original chars + '…'
    }

    #[test]
    fn truncate_empty() {
        assert_eq!(truncate("", 10), "");
    }

    #[test]
    fn truncate_utf8_safe() {
        let result = truncate("你好世界", 3); // each char is 3 bytes in UTF-8
        assert!(result.ends_with('…'));
    }

    #[test]
    fn extract_meta_name_attribute() {
        let html = r#"<meta name="description" content="A great page">"#;
        assert_eq!(
            extract_meta(html, "description"),
            Some("A great page".to_string())
        );
    }

    #[test]
    fn extract_meta_og_property() {
        let html = r#"<meta property="og:title" content="OG Title">"#;
        assert_eq!(extract_meta(html, "title"), Some("OG Title".to_string()));
    }

    #[test]
    fn extract_meta_not_found() {
        let html = r#"<meta name="keywords" content="a,b,c">"#;
        assert_eq!(extract_meta(html, "description"), None);
    }

    #[test]
    fn extract_title_og() {
        let html = r#"<head><meta property="og:title" content="OG Title"><title>Page Title</title></head>"#;
        assert_eq!(extract_title(html), Some("OG Title".to_string()));
    }

    #[test]
    fn extract_title_fallback_to_title_tag() {
        let html = r#"<head><title>  Page Title  </title></head>"#;
        assert_eq!(extract_title(html), Some("Page Title".to_string()));
    }

    #[test]
    fn extract_title_not_found() {
        let html = r#"<head></head>"#;
        assert_eq!(extract_title(html), None);
    }

    #[test]
    fn regex_match_captures_group() {
        let html = r#"<link rel="icon" href="/favicon.ico">"#;
        let p = r#"<link\s+[^>]*rel\s*=\s*["']icon["'][^>]*href\s*=\s*["']([^"']*)["']"#;
        assert_eq!(regex_match(p, html), Some("/favicon.ico".to_string()));
    }

    #[test]
    fn disallowed_ip_rejects_private_and_loopback() {
        assert!(is_disallowed_ip("127.0.0.1".parse().unwrap()));
        assert!(is_disallowed_ip("10.0.0.5".parse().unwrap()));
        assert!(is_disallowed_ip("192.168.1.1".parse().unwrap()));
        assert!(is_disallowed_ip("172.16.0.9".parse().unwrap()));
        assert!(is_disallowed_ip("169.254.169.254".parse().unwrap()));
        assert!(is_disallowed_ip("0.0.0.0".parse().unwrap()));
        assert!(is_disallowed_ip("::1".parse().unwrap()));
        assert!(is_disallowed_ip("fe80::1".parse().unwrap()));
        assert!(is_disallowed_ip("fd00::1".parse().unwrap()));
        // IPv4-mapped IPv6 同样按 IPv4 规则拒绝。
        assert!(is_disallowed_ip("::ffff:192.168.1.1".parse().unwrap()));
    }

    #[test]
    fn public_ips_are_allowed() {
        assert!(!is_disallowed_ip("8.8.8.8".parse().unwrap()));
        assert!(!is_disallowed_ip("1.1.1.1".parse().unwrap()));
        assert!(!is_disallowed_ip("2606:4700::1111".parse().unwrap()));
        // 172.32.x.x 属于公网段（私网是 172.16/12，即 172.16-172.31）。
        assert!(!is_disallowed_ip("172.32.0.1".parse().unwrap()));
    }

    #[test]
    fn validate_target_rejects_non_http_schemes() {
        for url in ["file:///C:/x", "ftp://example.com/a", "javascript:alert(1)"] {
            let err = validate_preview_target(url).unwrap_err();
            assert!(
                err.contains("[LINK_PREVIEW_SCHEME_REJECTED]"),
                "unexpected error for {url}: {err}"
            );
        }
    }

    #[test]
    fn validate_target_rejects_garbage_and_accepts_https() {
        assert!(
            validate_preview_target("not a url!!")
                .unwrap_err()
                .contains("[LINK_PREVIEW_URL_INVALID]")
        );

        let (parsed, host_port) = validate_preview_target("https://example.com/a").unwrap();
        assert_eq!(parsed.scheme(), "https");
        assert_eq!(host_port, "example.com:443");

        let (_, http_port) = validate_preview_target("http://example.com:8080/x").unwrap();
        assert_eq!(http_port, "example.com:8080");
    }
}
