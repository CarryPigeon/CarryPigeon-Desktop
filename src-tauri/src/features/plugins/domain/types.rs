//! plugins｜领域类型：types。

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub license: Option<String>,
    pub url: String,
    pub frontend_sha256: String,
    pub backend_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginLoadResult {
    pub frontend_wasm: String,
    pub frontend_js: String,
    pub frontend_html: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PluginProvidesDomain {
    pub domain: String,
    pub domain_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPluginState {
    pub plugin_id: String,
    pub installed_versions: Vec<String>,
    pub current_version: Option<String>,
    pub enabled: bool,
    pub status: String,
    pub last_error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginRuntimeEntry {
    pub server_id: String,
    pub plugin_id: String,
    pub version: String,
    pub entry: String,
    pub min_host_version: String,
    pub permissions: Vec<String>,
    pub provides_domains: Vec<PluginProvidesDomain>,
    /// 入口 API 版本（1 = 传统契约；2 = Cordis 契约）。
    pub entry_api_version: u32,
    /// IPC 白名单前缀（来自已校验的 plugin.json）。
    pub ipc_prefixes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginFetchResponse {
    pub ok: bool,
    pub status: u16,
    pub body_text: String,
    pub headers: HashMap<String, String>,
}

/// 插件密钥状态（不包含密钥内容）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSecretStatus {
    /// 是否已配置密钥。
    pub configured: bool,
    /// 系统安全存储（keyring）是否可用。
    pub secure_storage_available: bool,
}

#[derive(Debug, Clone)]
pub struct PluginInstallFromUrlRequest<'a> {
    pub server_socket: &'a str,
    pub plugin_id: &'a str,
    pub version: &'a str,
    pub url: &'a str,
    pub sha256: &'a str,
    pub tls_policy: Option<&'a str>,
    pub tls_fingerprint: Option<&'a str>,
}

#[derive(Debug, Clone)]
pub struct PluginNetworkFetchRequest<'a> {
    pub server_socket: &'a str,
    /// 发起请求的插件 id（跨源权限与 `@secret()` 命名空间归属）。
    pub plugin_id: &'a str,
    pub url: &'a str,
    pub method: &'a str,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    /// 请求超时（毫秒，可选；夹取到 [1000, 120000]）。
    pub timeout_ms: Option<u64>,
    pub tls_policy: Option<&'a str>,
    pub tls_fingerprint: Option<&'a str>,
}
