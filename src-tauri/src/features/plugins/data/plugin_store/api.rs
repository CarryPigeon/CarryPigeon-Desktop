//! plugin_store｜服务端 API 访问（server_id/catalog）。
//!
//! 说明：
//! - 该模块只负责 `/api/server` 与 `/api/plugins/catalog` 的请求与解析；
//! - 具体安装流程由上层编排（download/sha256/unpack/状态写入等）。

use anyhow::Context;
use serde::Deserialize;

use crate::shared::net::headers::API_ACCEPT_V1;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct ApiServerInfo {
    server_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) struct ApiPluginCatalog {
    pub(super) plugins: Vec<ApiCatalogItem>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) struct ApiCatalogItem {
    pub(super) plugin_id: String,
    pub(super) version: String,
    pub(super) download: Option<ApiDownload>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) struct ApiDownload {
    pub(super) url: String,
    pub(super) sha256: String,
}

pub(super) async fn fetch_server_id(
    origin: &str,
    client: &reqwest::Client,
) -> anyhow::Result<String> {
    let url = format!("{}/api/server", origin);
    let res = client
        .get(url)
        .header("Accept", API_ACCEPT_V1)
        .send()
        .await
        .context("Failed to request /api/server")?
        .error_for_status()
        .context("GET /api/server returned an error status")?;
    let info: ApiServerInfo = res
        .json()
        .await
        .context("Failed to parse /api/server JSON")?;
    let id = info.server_id.trim().to_string();
    if id.is_empty() {
        return Err(anyhow::anyhow!("Missing server_id in /api/server response"));
    }
    Ok(id)
}

pub(super) async fn fetch_plugin_catalog(
    origin: &str,
    client: &reqwest::Client,
) -> anyhow::Result<ApiPluginCatalog> {
    let url = format!("{}/api/plugins/catalog", origin);
    let res = client
        .get(url)
        .header("Accept", API_ACCEPT_V1)
        .send()
        .await
        .context("Failed to request /api/plugins/catalog")?
        .error_for_status()
        .context("GET /api/plugins/catalog returned an error status")?;
    res.json::<ApiPluginCatalog>()
        .await
        .context("Failed to parse /api/plugins/catalog JSON")
}
