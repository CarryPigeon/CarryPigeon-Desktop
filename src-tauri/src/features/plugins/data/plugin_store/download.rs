//! plugin_store｜下载逻辑（按同源决定 TLS client）。
//!
//! 说明：
//! - 同源下载需要继承“自签/指纹”TLS 策略，因此必须使用 `server_client`；
//! - 跨域插件包下载默认拒绝，避免把安装信任面扩大到不受控的域名。

use anyhow::Context;

use super::origin::port_suffix;

/// 判断两个 URL 是否同源（scheme + host + port）。
pub(super) fn is_same_origin(a: &reqwest::Url, b: &reqwest::Url) -> bool {
    a.scheme() == b.scheme() && a.host_str() == b.host_str() && port_suffix(a) == port_suffix(b)
}

/// 下载插件 zip 字节（仅允许同源）。
pub(super) async fn download_plugin_zip_bytes(
    base: &reqwest::Url,
    server_client: &reqwest::Client,
    download_url: reqwest::Url,
) -> anyhow::Result<Vec<u8>> {
    if !is_same_origin(&download_url, base) {
        return Err(anyhow::anyhow!("Cross-origin plugin download rejected by default"));
    }

    Ok(server_client
        .get(download_url)
        .send()
        .await
        .context("Failed to download plugin zip")?
        .error_for_status()
        .context("Plugin download returned an error status")?
        .bytes()
        .await
        .context("Failed to read plugin zip bytes")?
        .to_vec())
}
