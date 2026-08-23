//! plugin_store｜下载逻辑（按同源决定 TLS client）。
//!
//! 说明：
//! - 同源下载需要继承"自签/指纹"TLS 策略，因此必须使用 `server_client`；
//! - 跨域插件包下载默认拒绝，避免把安装信任面扩大到不受控的域名。

use anyhow::Context;

use super::origin::port_suffix;

/// 插件包下载体积硬上限（100MB），防止恶意服务器撑爆内存/磁盘。
const MAX_PLUGIN_DOWNLOAD_BYTES: usize = 100 * 1024 * 1024;

/// 判断两个 URL 是否同源（scheme + host + port）。
pub(super) fn is_same_origin(a: &reqwest::Url, b: &reqwest::Url) -> bool {
    a.scheme() == b.scheme() && a.host_str() == b.host_str() && port_suffix(a) == port_suffix(b)
}

/// 下载插件 zip 字节（仅允许同源；流式读取并强制体积上限）。
pub(super) async fn download_plugin_zip_bytes(
    base: &reqwest::Url,
    server_client: &reqwest::Client,
    download_url: reqwest::Url,
) -> anyhow::Result<Vec<u8>> {
    if !is_same_origin(&download_url, base) {
        return Err(anyhow::anyhow!(
            "Cross-origin plugin download rejected by default"
        ));
    }

    let response = server_client
        .get(download_url)
        .send()
        .await
        .context("Failed to download plugin zip")?
        .error_for_status()
        .context("Plugin download returned an error status")?;

    // 流式累计并在超过上限时立即中止，而不是把任意大小的响应整体读入内存。
    use futures_util::StreamExt;
    let mut bytes: Vec<u8> = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.context("Failed to read plugin zip chunk")?;
        if bytes.len().saturating_add(chunk.len()) > MAX_PLUGIN_DOWNLOAD_BYTES {
            return Err(anyhow::anyhow!(
                "Plugin package exceeds maximum download size ({MAX_PLUGIN_DOWNLOAD_BYTES} bytes)"
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_origin_identical() {
        let a = reqwest::Url::parse("https://example.com/path").unwrap();
        let b = reqwest::Url::parse("https://example.com/other").unwrap();
        assert!(is_same_origin(&a, &b));
    }

    #[test]
    fn different_scheme() {
        let a = reqwest::Url::parse("https://example.com").unwrap();
        let b = reqwest::Url::parse("http://example.com").unwrap();
        assert!(!is_same_origin(&a, &b));
    }

    #[test]
    fn different_host() {
        let a = reqwest::Url::parse("https://example.com").unwrap();
        let b = reqwest::Url::parse("https://other.com").unwrap();
        assert!(!is_same_origin(&a, &b));
    }

    #[test]
    fn different_port_explicit() {
        let a = reqwest::Url::parse("https://example.com:8080").unwrap();
        let b = reqwest::Url::parse("https://example.com:8443").unwrap();
        assert!(!is_same_origin(&a, &b));
    }

    #[test]
    fn different_port_implicit_vs_explicit() {
        let a = reqwest::Url::parse("https://example.com").unwrap();
        let b = reqwest::Url::parse("https://example.com:8443").unwrap();
        assert!(!is_same_origin(&a, &b));
    }

    #[test]
    fn same_origin_with_default_port() {
        let a = reqwest::Url::parse("https://example.com").unwrap();
        let b = reqwest::Url::parse("https://example.com").unwrap();
        assert!(is_same_origin(&a, &b));
    }
}
