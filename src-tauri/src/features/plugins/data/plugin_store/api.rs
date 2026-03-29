//! plugin_store｜服务端 API 访问（server_id/catalog）。
//!
//! 说明：
//! - 该模块只负责 `/api/server` 与 `/api/plugins/catalog` 的请求与解析；
//! - 具体安装流程由上层编排（download/sha256/unpack/状态写入等）。

use anyhow::Context;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::OnceLock;
use tokio::sync::RwLock;

use super::paths::base_plugins_dir;
use super::tls::build_server_client;
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

type ServerIdCache = HashMap<String, String>;
static SERVER_ID_CACHE: OnceLock<RwLock<ServerIdCache>> = OnceLock::new();

fn server_id_cache() -> &'static RwLock<ServerIdCache> {
    SERVER_ID_CACHE.get_or_init(|| RwLock::new(HashMap::new()))
}

fn server_id_cache_file() -> std::path::PathBuf {
    base_plugins_dir().join("server-id-cache.json")
}

async fn read_server_id_cache_file() -> ServerIdCache {
    let path = server_id_cache_file();
    let raw = match tokio::fs::read_to_string(&path).await {
        Ok(v) => v,
        Err(_) => return HashMap::new(),
    };
    serde_json::from_str::<ServerIdCache>(&raw).unwrap_or_default()
}

async fn persist_server_id_cache_file(cache: &ServerIdCache) {
    let path = server_id_cache_file();
    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    if let Ok(raw) = serde_json::to_string_pretty(cache) {
        let _ = tokio::fs::write(path, raw).await;
    }
}

pub(super) async fn get_cached_server_id(origin: &str) -> Option<String> {
    let key = origin.trim().to_string();
    if key.is_empty() {
        return None;
    }
    if let Some(cached) = server_id_cache().read().await.get(&key).cloned() {
        return Some(cached);
    }
    let file_cache = read_server_id_cache_file().await;
    let cached = file_cache.get(&key).cloned();
    if let Some(ref server_id) = cached {
        server_id_cache()
            .write()
            .await
            .insert(key, server_id.clone());
    }
    cached
}

async fn fetch_server_id_network(origin: &str, client: &reqwest::Client) -> anyhow::Result<String> {
    let key = origin.trim().to_string();
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

    if !key.is_empty() {
        server_id_cache()
            .write()
            .await
            .insert(key.clone(), id.clone());
        let mut file_cache = read_server_id_cache_file().await;
        file_cache.insert(key, id.clone());
        persist_server_id_cache_file(&file_cache).await;
    }
    Ok(id)
}

pub(super) async fn fetch_server_id_with_client(
    origin: &str,
    client: &reqwest::Client,
) -> anyhow::Result<String> {
    if let Some(cached) = get_cached_server_id(origin).await {
        return Ok(cached);
    }
    fetch_server_id_network(origin, client).await
}

pub(super) async fn fetch_server_id(
    origin: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<String> {
    if let Some(cached) = get_cached_server_id(origin).await {
        return Ok(cached);
    }
    let client = build_server_client(origin, tls_policy, tls_fingerprint).await?;
    fetch_server_id_network(origin, &client).await
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
