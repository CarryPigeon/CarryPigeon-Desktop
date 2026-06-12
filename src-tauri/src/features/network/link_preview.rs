//! network｜链接预览抓取。
//!
//! 通过 HTTP GET 获取目标网页，提取 title、description、Open Graph 标签。
//! 超时 5s，响应体限制 512KB。

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
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .user_agent("Mozilla/5.0 (compatible; CarryPigeon/1.0)")
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

    // Read up to 512KB
    let bytes = resp.bytes().await.map_err(|e| {
        to_command_error(
            "LINK_PREVIEW_READ_BODY_FAILED",
            "error.link_preview_read_body_failed",
            e,
        )
    })?;
    let html = String::from_utf8_lossy(&bytes[..bytes.len().min(512 * 1024)]);

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
