//! plugin_store｜下载逻辑（按同源决定 TLS client）。
//!
//! 说明：
//! - 同源下载需要继承“自签/指纹”TLS 策略，因此必须使用 `server_client`；
//! - 跨域下载使用默认 client，避免把“放宽 TLS”扩大到不受控的域名。

use anyhow::Context;

use super::origin::port_suffix;

/// 判断两个 URL 是否同源（scheme + host + port）。
pub(super) fn is_same_origin(a: &reqwest::Url, b: &reqwest::Url) -> bool {
    a.scheme() == b.scheme() && a.host_str() == b.host_str() && port_suffix(a) == port_suffix(b)
}

/// 下载插件 zip 字节（同源使用 server client；跨域使用默认 client）。
pub(super) async fn download_plugin_zip_bytes(
    base: &reqwest::Url,
    server_client: &reqwest::Client,
    download_url: reqwest::Url,
) -> anyhow::Result<Vec<u8>> {
    Ok((if is_same_origin(&download_url, base) {
        server_client.get(download_url)
    } else {
        reqwest::Client::new().get(download_url)
    })
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
